const express = require('express');
const app = express();
app.use(express.json());

const API_KEY = process.env.OPENROUTER_API_KEY;

// АКТУАЛЬНЫЕ бесплатные модели (2025, pricing: 0/0)
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
    status: "Akinator Unlimited!",
    workingModel: workingModel || "searching...",
    totalModels: MODELS.length
  });
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
- ONE question per turn
- QUESTION:text — to ask
- GUESS:name — to guess
- Output ONLY one line. Nothing else
- Only REAL characters. NEVER invent
- 80%+ sure before guessing
- Wrong guess = keep asking
Known: Anime(Naruto,OnePiece,BlueLock:Isagi/Rin/Nagi/Bachira/Chigiri/Barou,AOT,DemonSlayer,JJK,MHA,DeathNote,Bleach,HxH,SpyxFamily,ChainsawMan), Games(Minecraft,Roblox,GTA,Fortnite,FNAF,Genshin,BrawlStars), Movies(Marvel,DC,HarryPotter,StarWars,Disney,Pixar,SpongeBob,GravityFalls), RussianCartoons(Барбоскины:Роза/Лиза/Гена/Дружок/Малыш,МашаИМедведь,Смешарики:Крош/Ёжик/Нюша/Бараш/Копатыч/Лосяш,Фиксики:Нолик/Симка,Лунтик,ТриКота:Коржик/Компот/Карамелька,Простоквашино:Матроскин/Шарик/ДядяФёдор,Чебурашка,НуПогоди), RealPeople`;

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    // Сначала рабочую модель, потом остальные
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
  console.log(`Akinator on port ${PORT}`);
  console.log(`Models: ${MODELS.join(', ')}`);
});
