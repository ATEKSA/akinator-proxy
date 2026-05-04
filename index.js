const express = require('express');
const app = express();
app.use(express.json());

const GROQ_KEYS = [
  process.env.GROQ_KEY_1,
  process.env.GROQ_KEY_2,
  process.env.GROQ_KEY_3,
].filter(Boolean);

let keyIndex = 0;
function getKey() {
  const key = GROQ_KEYS[keyIndex % GROQ_KEYS.length];
  keyIndex++;
  return key;
}

// Поиск картинки персонажа через Wikipedia API
async function findCharacterImage(name) {
  try {
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
    const res = await fetch(searchUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.thumbnail && data.thumbnail.source) {
        return data.thumbnail.source;
      }
    }
    // Пробуем поиск
    const searchUrl2 = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&format=json&srlimit=1`;
    const res2 = await fetch(searchUrl2);
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2.query?.search?.[0]) {
        const pageTitle = data2.query.search[0].title;
        const pageUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
        const res3 = await fetch(pageUrl);
        if (res3.ok) {
          const data3 = await res3.json();
          if (data3.thumbnail?.source) return data3.thumbnail.source;
        }
      }
    }
  } catch(e) {
    console.log("Image search error:", e.message);
  }
  return null;
}

app.get('/', (req, res) => {
  res.json({ status: "Akinator v8.0 Luxury", keys: GROQ_KEYS.length });
});

// Эндпоинт для поиска картинки
app.post('/image', async (req, res) => {
  try {
    const { name } = req.body;
    const imageUrl = await findCharacterImage(name || "");
    res.json({ image: imageUrl });
  } catch(e) {
    res.json({ image: null });
  }
});

const langMap = {
  "en": "You MUST respond ONLY in English.",
  "ru": "Ты ОБЯЗАН отвечать ТОЛЬКО на русском языке.",
  "es": "Debes responder SOLO en español.",
  "pt": "Você deve responder APENAS em português.",
  "fr": "Tu dois répondre UNIQUEMENT en français.",
  "de": "Du musst NUR auf Deutsch antworten.",
  "tr": "SADECE Türkçe yanıt vermelisin.",
  "ar": "يجب أن تجيب باللغة العربية فقط."
};

app.post('/ask', async (req, res) => {
  try {
    if (GROQ_KEYS.length === 0) {
      return res.status(500).json({ type: "error", value: "No keys" });
    }

    const { messages, lang } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ type: "error", value: "Bad request" });
    }

    const langRule = langMap[lang] || langMap["en"];

    // ИИ сам думает — никаких списков персонажей
    const systemPrompt = `You are Akinator, the legendary web genie who can guess ANY character ever created or existed.

${langRule}

You have VAST knowledge of:
- ALL anime and manga characters ever created
- ALL cartoon characters from every country
- ALL movie and TV show characters
- ALL video game characters
- ALL book and comic characters
- ALL real people (celebrities, athletes, politicians, YouTubers, streamers)
- ALL internet memes and fictional characters
- Characters from Russian, American, Japanese, Korean, Chinese, European media

YOUR STRATEGY:
1. Start VERY broad: Is the character real or fictional?
2. Then medium: What type of media? What country/culture?
3. Then narrow: What specific show/game/movie? What role?
4. Then specific: Appearance, abilities, relationships
5. Make your guess when confident

ABSOLUTE RULES:
- Ask ONE yes/no question per turn
- Format: QUESTION:your question here
- When guessing: GUESS:Full Character Name
- Output ONLY one line. NOTHING else. No explanations.
- NEVER invent fake characters
- Be at least 80% confident before guessing
- If your guess is wrong, ask MORE questions, think HARDER
- You are extremely smart and knowledgeable`;

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    for (let i = 0; i < GROQ_KEYS.length; i++) {
      const key = getKey();
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gemma2-9b-it",
            messages: allMessages,
            temperature: 0.15,
            max_tokens: 80
          })
        });

        if (response.status === 429) { console.log(`Key ${i+1} limited`); continue; }

        const text = await response.text();
        if (response.status !== 200) { console.log(`Error ${response.status}`); continue; }

        const data = JSON.parse(text);
        if (!data.choices?.[0]?.message?.content) continue;

        const reply = data.choices[0].message.content.trim();
        console.log("AI:", reply);

        let result = {};
        const gm = reply.match(/GUESS:\s*(.+)/i);
        const qm = reply.match(/QUESTION:\s*(.+)/i);

        if (gm) {
          result = { type: "guess", value: gm[1].trim() };
        } else if (qm) {
          result = { type: "question", value: qm[1].trim() };
        } else {
          result = { type: "question", value: reply.replace(/^(QUESTION:|GUESS:)/i, "").trim() };
        }

        return res.json(result);
      } catch(err) {
        console.log(`Key ${i+1} error:`, err.message);
      }
    }

    return res.status(429).json({ type: "error", value: "rate_limit" });
  } catch(error) {
    console.error("Error:", error.message);
    res.status(500).json({ type: "error", value: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Akinator v8.0 on port ${PORT}`));
