const express = require('express');
const app = express();
app.use(express.json());

const API_KEY = process.env.OPENROUTER_API_KEY;

// Актуальные бесплатные модели OpenRouter (2025)
const MODELS = [
  "meta-llama/llama-3.2-3b-instruct:free",
  "meta-llama/llama-3.2-1b-instruct:free",
  "meta-llama/llama-4-scout:free",
  "meta-llama/llama-4-maverick:free",
  "google/gemini-2.0-flash-exp:free",
  "google/gemini-2.5-pro-exp-03-25:free",
  "deepseek/deepseek-chat:free",
  "deepseek/deepseek-r1:free",
  "deepseek/deepseek-v3-base:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "qwen/qwen2.5-vl-3b-instruct:free",
  "qwen/qwen2.5-vl-72b-instruct:free",
  "nvidia/llama-3.1-nemotron-ultra-253b-v1:free",
  "tngtech/deepseek-r1t-chimera:free",
  "shisa-ai/shisa-v2-llama3.3-70b:free",
];

let modelIndex = 0;
let workingModel = null; // Кэшируем рабочую модель

async function fetchAvailableModels() {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Authorization": `Bearer ${API_KEY}` }
    });
    const data = await res.json();
    const freeModels = data.data
      .filter(m => m.id.includes(":free"))
      .map(m => m.id);
    console.log(`Found ${freeModels.length} free models`);
    if (freeModels.length > 0) {
      MODELS.length = 0;
      freeModels.forEach(m => MODELS.push(m));
    }
  } catch (e) {
    console.log("Could not fetch models:", e.message);
  }
}

// Обновляем список моделей при старте
fetchAvailableModels();

app.get('/', (req, res) => {
  res.json({
    status: "Akinator Unlimited!",
    workingModel: workingModel || "searching...",
    totalModels: MODELS.length,
    models: MODELS.slice(0, 5)
  });
});

app.get('/models', async (req, res) => {
  await fetchAvailableModels();
  res.json({ models: MODELS });
});

async function callModel(model, messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

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
- QUESTION:text — to ask a question
- GUESS:name — to guess the character
- Output ONLY one line. Nothing else ever.
- Only REAL characters. NEVER invent.
- 80%+ sure before guessing.
- Wrong guess = keep asking questions.
Universes: Anime(Naruto/OnePiece/BlueLock/AOT/DemonSlayer/JJK/MHA/DeathNote/Bleach/HxH), Games(Minecraft/Roblox/GTA/Fortnite/FNAF/Genshin/BrawlStars), Movies(Marvel/DC/HarryPotter/StarWars/Disney/Pixar), RussianCartoons(Барбоскины:Роза,Лиза,Гена,Дружок,Малыш/МашаИМедведь/Смешарики/Фиксики/Лунтик/ТриКота/Простоквашино/Чебурашка/НуПогоди), RealPeople(YouTubers/athletes/musicians/politicians)`;

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    // Если есть рабочая модель — пробуем её первой
    const modelsToTry = workingModel
      ? [workingModel, ...MODELS.filter(m => m !== workingModel)]
      : MODELS;

    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];
      console.log(`[${i+1}/${modelsToTry.length}] Trying: ${model}`);

      try {
        const response = await callModel(model, allMessages);
        const responseText = await response.text();
        console.log(`Status: ${response.status}`);

        if (response.status !== 200) {
          console.log(`❌ ${model} → ${response.status}`);
          if (model === workingModel) workingModel = null;
          continue;
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          console.log("JSON parse failed");
          continue;
        }

        if (!data.choices?.[0]?.message?.content) {
          console.log("Empty response");
          continue;
        }

        const reply = data.choices[0].message.content.trim();
        console.log("✅ AI:", reply);

        if (!reply || reply.length < 3) continue;

        // Кэшируем рабочую модель
        workingModel = model;

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

      } catch (err) {
        console.log(`❌ ${model} timeout: ${err.message}`);
        if (model === workingModel) workingModel = null;
        continue;
      }
    }

    // Обновляем список моделей на следующий раз
    fetchAvailableModels();

    return res.status(503).json({
      type: "error",
      value: "All models unavailable, try again"
    });

  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ type: "error", value: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Akinator Unlimited on port ${PORT}`);
});
