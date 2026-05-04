const express = require('express');
const app = express();
app.use(express.json());

const API_KEY = process.env.OPENROUTER_API_KEY;

const MODELS = [
  "meta-llama/llama-3.1-8b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen-2-7b-instruct:free",
  "qwen/qwen-2-72b-instruct:free",
  "microsoft/phi-3-mini-128k-instruct:free",
  "huggingfaceh4/zephyr-7b-beta:free",
  "openchat/openchat-7b:free",
  "gryphe/mythomist-7b:free",
];

let modelIndex = 0;

app.get('/', (req, res) => {
  res.json({
    status: "Akinator Unlimited!",
    currentModel: MODELS[modelIndex],
    totalModels: MODELS.length
  });
});

async function callAI(apiKey, model, messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15 сек таймаут

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://akinator-proxy.onrender.com",
        "X-Title": "Roblox Akinator"
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.2,
        max_tokens: 80,
        route: "fallback"  // OpenRouter сам переключит если модель недоступна
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
Language: ${langRule}
Rules:
- ONE question per turn.
- QUESTION:text — to ask
- GUESS:name — to guess
- Nothing else. No extra text ever.
- Only REAL characters. Never invent.
- 80%+ sure before guessing.
- Wrong guess = ask more questions.
Universes: Anime(Naruto/OnePiece/BlueLock/AOT/DemonSlayer/JJK/MHA/DeathNote), Games(Minecraft/Roblox/GTA/Fortnite/FNAF/Genshin), Movies(Marvel/DC/HarryPotter/StarWars/Disney), RussianCartoons(Барбоскины:Роза,Лиза,Гена,Дружок,Малыш/МашаИМедведь/Смешарики/Фиксики/Лунтик/ТриКота/Простоквашино/Чебурашка/НуПогоди), RealPeople(YouTubers/athletes/musicians)`;

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    // Пробуем все модели по кругу
    for (let i = 0; i < MODELS.length; i++) {
      const model = MODELS[modelIndex];
      console.log(`[${i+1}/${MODELS.length}] Trying: ${model}`);

      try {
        const response = await callAI(API_KEY, model, allMessages);
        const responseText = await response.text();

        console.log(`Status: ${response.status}`);

        if (response.status === 200) {
          let data;
          try {
            data = JSON.parse(responseText);
          } catch {
            console.log("JSON parse failed, trying next model");
            modelIndex = (modelIndex + 1) % MODELS.length;
            continue;
          }

          if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.log("No valid response, trying next");
            modelIndex = (modelIndex + 1) % MODELS.length;
            continue;
          }

          const reply = data.choices[0].message.content.trim();
          console.log("AI:", reply);

          if (!reply || reply.length < 3) {
            modelIndex = (modelIndex + 1) % MODELS.length;
            continue;
          }

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
            // ИИ ответил не по формату — берём как есть
            result.type = "question";
            result.value = reply.replace(/^(QUESTION:|GUESS:)/i, "").trim();
          }

          // Успех! Запоминаем рабочую модель
          console.log(`✅ Success with: ${model}`);
          return res.json(result);
        }

        // Не 200 — пробуем следующую
        console.log(`Model ${model} returned ${response.status}, switching...`);
        modelIndex = (modelIndex + 1) % MODELS.length;

      } catch (fetchError) {
        console.log(`Model ${model} timeout/error: ${fetchError.message}`);
        modelIndex = (modelIndex + 1) % MODELS.length;
      }
    }

    // Все модели не ответили
    return res.status(503).json({
      type: "error",
      value: "All models unavailable"
    });

  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ type: "error", value: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Akinator Unlimited on port ${PORT}`);
  console.log(`${MODELS.length} models available`);
});
