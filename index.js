const express = require('express');
const app = express();
app.use(express.json());

const API_KEY = process.env.OPENROUTER_API_KEY;

const MODELS = [
  "openrouter/owl-alpha",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "poolside/laguna-xs.2:free",
  "poolside/laguna-m.1:free",
  "inclusionai/ling-2.6-1t:free",
  "tencent/hy3-preview:free",
];

let workingModel = null;

app.get('/', (req, res) => {
  res.json({
    status: "Akinator v8.0 Unlimited!",
    workingModel: workingModel || "searching...",
    totalModels: MODELS.length
  });
});

// Поиск картинки через Wikipedia
async function findImage(name) {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
    const r = await fetch(url);
    if (r.ok) {
      const d = await r.json();
      if (d.thumbnail?.source) return d.thumbnail.source;
    }
    const url2 = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&format=json&srlimit=1`;
    const r2 = await fetch(url2);
    if (r2.ok) {
      const d2 = await r2.json();
      if (d2.query?.search?.[0]) {
        const title = d2.query.search[0].title;
        const r3 = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
        if (r3.ok) {
          const d3 = await r3.json();
          if (d3.thumbnail?.source) return d3.thumbnail.source;
        }
      }
    }
  } catch(e) {}
  return null;
}

app.post('/image', async (req, res) => {
  const { name } = req.body;
  const img = await findImage(name || "");
  res.json({ image: img });
});

async function callModel(model, messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://akinator-proxy.onrender.com",
        "X-Title": "Roblox Akinator"
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.2,
        max_tokens: 100
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

app.post('/ask', async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ type: "error", value: "OPENROUTER_API_KEY not set" });
    }

    const { messages, lang } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ type: "error", value: "Bad request" });
    }

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

    const langRule = langMap[lang] || langMap["en"];

    // ИИ сам думает — никаких подсказок
    const systemPrompt = `You are Akinator, the legendary web genie who can guess ANY character.

${langRule}

You have enormous knowledge about ALL characters from:
- Every anime and manga ever made
- Every cartoon from every country (including Russian, American, Japanese, European)
- Every movie, TV show, and web series
- Every video game
- Every book, comic, and graphic novel
- Every real person (celebrities, athletes, politicians, YouTubers, streamers, musicians)
- Internet memes, mascots, and other fictional characters

YOUR STRATEGY (figure it out yourself):
1. Start broad — narrow down step by step
2. Ask smart questions that eliminate the most possibilities
3. Think logically about what categories remain
4. Only guess when you are truly confident

ABSOLUTE RULES:
- Ask ONE yes/no question per turn
- To ask a question: QUESTION:your question here
- To make a guess: GUESS:Full Character Name
- Output ONLY one single line starting with QUESTION: or GUESS:
- NEVER output anything else. No explanations, no thinking out loud.
- NEVER invent or make up characters that don't exist
- If your guess is wrong, think harder and ask better questions
- Be at least 80% confident before guessing`;

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    const order = workingModel
      ? [workingModel, ...MODELS.filter(m => m !== workingModel)]
      : [...MODELS];

    for (let i = 0; i < order.length; i++) {
      const model = order[i];
      console.log(`[${i+1}/${order.length}] ${model}`);

      try {
        const response = await callModel(model, allMessages);
        const text = await response.text();
        console.log(`Status: ${response.status}`);

        if (response.status !== 200) {
          console.log(`❌ ${response.status}: ${text.substring(0, 100)}`);
          if (model === workingModel) workingModel = null;
          continue;
        }

        let data;
        try { data = JSON.parse(text); } catch {
          console.log("JSON fail"); continue;
        }

        if (!data.choices?.[0]?.message?.content) {
          console.log("Empty"); continue;
        }

        const reply = data.choices[0].message.content.trim();
        console.log("✅", reply);

        if (reply.length < 3) continue;

        workingModel = model;

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

      } catch (err) {
        console.log(`❌ ${model}: ${err.message}`);
        if (model === workingModel) workingModel = null;
      }
    }

    return res.status(503).json({ type: "error", value: "All models unavailable" });

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ type: "error", value: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Akinator v8.0 on port ${PORT}`);
  console.log(`Models: ${MODELS.join(', ')}`);
});
