const express = require('express');
const app = express();
app.use(express.json());

const API_KEY = process.env.GROQ_API_KEY;

app.get('/', (req, res) => {
  res.json({ 
    status: "Akinator Proxy is running!",
    hasKey: !!API_KEY,
    model: "llama-3.3-70b-versatile"
  });
});

app.post('/ask', async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ 
        type: "error", 
        value: "GROQ_API_KEY is not set!" 
      });
    }

    const { messages, lang } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        type: "error", 
        value: "Invalid request body" 
      });
    }

    const langInstructions = {
      "en": "Communicate ONLY in English.",
      "ru": "Общайся ТОЛЬКО на русском языке.",
      "es": "Comunícate SOLO en español.",
      "pt": "Comunique-se APENAS em português.",
      "fr": "Communique UNIQUEMENT en français.",
      "de": "Kommuniziere NUR auf Deutsch.",
      "ja": "日本語のみで会話してください。",
      "zh": "只用中文交流。",
      "ko": "한국어로만 대화하세요.",
      "tr": "SADECE Türkçe iletişim kur.",
      "ar": "تواصل باللغة العربية فقط."
    };

    const langRule = langInstructions[lang] || langInstructions["en"];

    const systemPrompt = 
      "You are Akinator, genius of guessing characters. " +
      langRule + "\n" +
      "Rules:\n" +
      "1. Ask ONE question at a time.\n" +
      "2. Questions must be Yes/No.\n" +
      "3. Start with broad questions, then get specific.\n" +
      "4. When 85%+ confident, make a guess.\n" +
      "5. Guess format: GUESS:Character Name\n" +
      "6. Question format: QUESTION:Your question text\n" +
      "7. STRICTLY respond ONLY in one of these formats.\n" +
      "8. No extra text outside the format.\n" +
      "9. If wrong guess and player says no, keep asking.\n" +
      "10. You can guess anyone: anime, movies, games, real people, memes.\n" +
      "11. Language rule is ABSOLUTE. Never switch language.";

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    console.log("Sending request to Groq...");
    console.log("Lang:", lang);
    console.log("Messages count:", messages.length);

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",  // ✅ Новая модель
          messages: allMessages,
          temperature: 0.3,
          max_tokens: 200
        })
      }
    );

    const responseText = await response.text();
    console.log("Groq status:", response.status);
    console.log("Groq response:", responseText.substring(0, 200));

    if (!response.ok) {
      return res.status(500).json({ 
        type: "error", 
        value: "Groq API error: " + response.status
      });
    }

    const data = JSON.parse(responseText);
    const reply = data.choices[0].message.content.trim();

    console.log("AI reply:", reply);

    let result = {};

    if (reply.includes("GUESS:")) {
      result.type = "guess";
      result.value = reply.split("GUESS:")[1].trim();
    } else if (reply.includes("QUESTION:")) {
      result.type = "question";
      result.value = reply.split("QUESTION:")[1].trim();
    } else {
      result.type = "question";
      result.value = reply;
    }

    console.log("Sending result:", result);
    res.json(result);

  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ 
      type: "error", 
      value: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Akinator Proxy running on port ${PORT}`);
  console.log(`API Key set: ${!!API_KEY}`);
});
