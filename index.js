const express = require('express');
const app = express();
app.use(express.json());

const API_KEY = process.env.GROQ_API_KEY;

app.get('/', (req, res) => {
  res.json({ status: "Akinator v4.0 running!", model: "llama-3.3-70b-versatile" });
});

app.post('/ask', async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ type: "error", value: "API KEY missing" });
    }

    const { messages, lang } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ type: "error", value: "Bad request" });
    }

    const langInstructions = {
      "en": "You MUST communicate ONLY in English. Every question and guess must be in English.",
      "ru": "Ты ОБЯЗАН общаться ТОЛЬКО на русском языке. Каждый вопрос и догадка должны быть на русском.",
      "es": "DEBES comunicarte SOLO en español.",
      "pt": "Você DEVE se comunicar APENAS em português.",
      "fr": "Tu DOIS communiquer UNIQUEMENT en français.",
      "de": "Du MUSST NUR auf Deutsch kommunizieren.",
      "ja": "必ず日本語のみで会話してください。",
      "zh": "你必须只用中文交流。",
      "ko": "반드시 한국어로만 대화하세요.",
      "tr": "SADECE Türkçe iletişim kurmalısın.",
      "ar": "يجب أن تتواصل باللغة العربية فقط."
    };

    const langRule = langInstructions[lang] || langInstructions["en"];

    const systemPrompt = `You are Akinator — the legendary web genie who can guess ANY character.

${langRule}

YOUR STRATEGY (follow this EXACTLY):
1. Start with the broadest categories: real vs fictional, male vs female, from which medium (anime/movie/game/book/real life).
2. Then narrow down: genre, era, nationality, franchise.
3. Then specifics: appearance, powers, relationships, role in story.
4. You have 25 questions maximum. Use them wisely.
5. Ask ONE yes/no question at a time.

IMPORTANT KNOWLEDGE:
- You know characters from ALL anime (Naruto, One Piece, Dragon Ball, Blue Lock, Demon Slayer, Attack on Titan, Jujutsu Kaisen, My Hero Academia, Death Note, etc.)
- You know characters from ALL movies, TV shows, video games, books, comics, manga.
- You know real people: celebrities, athletes, politicians, YouTubers, streamers.
- You know meme characters, internet personalities, historical figures.
- For anime: think about specific series, character roles (protagonist, antagonist, side character), abilities, teams, jersey numbers, positions.
- For Blue Lock specifically: Isagi Yoichi, Rin Itoshi, Nagi Seishiro, Bachira Meguru, Chigiri Hyoma, Barou Shouei, etc.

RESPONSE FORMAT (STRICT):
- To ask a question: QUESTION:Your question here
- To make a guess: GUESS:Character Name
- NEVER write anything else. No explanations, no "I think", no extra text.
- Only output ONE line starting with QUESTION: or GUESS:

GUESSING RULES:
- When you are 80%+ confident, make a guess.
- If player says your guess is wrong, DO NOT give up. Ask more specific questions.
- Try to guess at least 2-3 times before giving up.
- Include the full name when guessing (e.g., "Isagi Yoichi" not just "Isagi").

ANSWER INTERPRETATION:
- "Да" or "Yes" = Yes
- "Нет" or "No" = No  
- "Скорее да" or "Probably yes" = Leaning yes but not certain
- "Скорее нет" or "Probably no" = Leaning no but not certain
- "Не знаю" or "Don't know" = Player is unsure, treat as neutral`;

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    console.log("Request | Lang:", lang, "| Messages:", messages.length);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: allMessages,
        temperature: 0.2,
        max_tokens: 150,
        top_p: 0.9
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("Groq error:", response.status, responseText.substring(0, 200));
      return res.status(500).json({ type: "error", value: "AI error " + response.status });
    }

    const data = JSON.parse(responseText);
    const reply = data.choices[0].message.content.trim();

    console.log("AI:", reply);

    let result = {};
    
    // Ищем GUESS: в любом месте ответа
    const guessMatch = reply.match(/GUESS:\s*(.+)/i);
    const questionMatch = reply.match(/QUESTION:\s*(.+)/i);

    if (guessMatch) {
      result.type = "guess";
      result.value = guessMatch[1].trim();
    } else if (questionMatch) {
      result.type = "question";
      result.value = questionMatch[1].trim();
    } else {
      // Если формат сломан — считаем как вопрос
      result.type = "question";
      result.value = reply.replace(/^(QUESTION:|GUESS:)/i, "").trim();
    }

    res.json(result);

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ type: "error", value: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Akinator v4.0 on port ${PORT}`));
