const express = require('express');
const app = express();
app.use(express.json());

const API_KEY = process.env.OPENROUTER_API_KEY;

// Бесплатные модели — ротация если одна не работает
const FREE_MODELS = [
  "meta-llama/llama-3.1-8b-instruct:free",
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen-2-7b-instruct:free",
];

let modelIndex = 0;

app.get('/', (req, res) => {
  res.json({ 
    status: "Akinator Unlimited running!",
    provider: "OpenRouter",
    model: FREE_MODELS[modelIndex]
  });
});

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
      "en": "English only.",
      "ru": "Только русский язык.",
      "es": "Solo español.",
      "pt": "Só português.",
      "fr": "Français seulement.",
      "de": "Nur Deutsch.",
      "ja": "日本語のみ。",
      "zh": "只用中文。",
      "ko": "한국어만.",
      "tr": "Sadece Türkçe.",
      "ar": "عربي فقط."
    };

    const langRule = langMap[lang] || langMap["en"];

    const systemPrompt = `You are Akinator. Guess the character by asking yes/no questions.
Language rule: ${langRule}
Rules:
- ONE question per turn.
- Format for question: QUESTION:text
- Format for guess: GUESS:name
- NEVER output anything else. No explanations.
- Only guess REAL existing characters. NEVER invent.
- 80%+ confidence before guessing.
- If wrong guess, ask more questions before guessing again.
Known universes: 
Anime: Naruto, One Piece, Dragon Ball, Blue Lock, Attack on Titan, Demon Slayer, JJK, MHA, Death Note, One Punch Man, Spy x Family, Chainsaw Man, Tokyo Ghoul, Bleach, HxH, FMA, SAO, Re:Zero
Games: Minecraft, Roblox, GTA, Fortnite, Among Us, FNAF, Undertale, Genshin Impact, Brawl Stars, Clash Royale
Movies/TV: Marvel, DC, Harry Potter, Star Wars, Disney, Pixar, Shrek, SpongeBob, Gravity Falls
Russian cartoons: Барбоскины (Роза, Лиза, Гена, Дружок, Малыш, Мама, Папа), Маша и Медведь, Смешарики (Крош, Ёжик, Нюша, Бараш, Копатыч, Лосяш), Фиксики (Нолик, Симка), Лунтик, Три кота, Простоквашино (Матроскин, Шарик, Дядя Фёдор), Чебурашка, Ну погоди
Real people: YouTubers, athletes, musicians, politicians, streamers`;

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    // Пробуем модели по очереди
    let lastError = null;

    for (let attempt = 0; attempt < FREE_MODELS.length; attempt++) {
      const model = FREE_MODELS[modelIndex];
      console.log(`Trying model: ${model}`);

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
          messages: allMessages,
          temperature: 0.2,
          max_tokens: 80
        })
      });

      const responseText = await response.text();
      console.log(`Status: ${response.status}`);

      // Если модель недоступна — пробуем следующую
      if (response.status === 429 || response.status === 503 || response.status === 502) {
        console.log(`Model ${model} unavailable, switching...`);
        modelIndex = (modelIndex + 1) % FREE_MODELS.length;
        lastError = responseText;
        continue;
      }

      if (!response.ok) {
        console.error("Error:", response.status, responseText.substring(0, 200));
        modelIndex = (modelIndex + 1) % FREE_MODELS.length;
        continue;
      }

      const data = JSON.parse(responseText);
      
      if (!data.choices || !data.choices[0]) {
        console.error("No choices in response");
        modelIndex = (modelIndex + 1) % FREE_MODELS.length;
        continue;
      }

      const reply = data.choices[0].message.content.trim();
      console.log("AI reply:", reply);

      let result = {};
      const guessMatch = reply.match(/GUESS:\s*(.+)/i);
      const questionMatch = reply.match(/QUESTION:\s*(.+)/i);

      if (guessMatch) {
        result.type = "guess";
        result.value = guessMatch[1].trim();
      } else if (questionMatch) {
        result.type = "question";
        result.value = questionMatch[1].trim();
      } else {
        result.type = "question";
        result.value = reply.replace(/^(QUESTION:|GUESS:)/i, "").trim();
      }

      return res.json(result);
    }

    // Все модели недоступны
    return res.status(503).json({
      type: "error",
      value: "All models unavailable, try again later"
    });

  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ type: "error", value: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Akinator Unlimited on port ${PORT}`);
  console.log(`Starting with model: ${FREE_MODELS[0]}`);
});
