const express = require('express');
const app = express();
app.use(express.json());

const API_KEY = process.env.GROQ_API_KEY;

app.get('/', (req, res) => {
  res.json({ status: "Akinator v5.1 running!" });
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
      "en": "You MUST communicate ONLY in English.",
      "ru": "Ты ОБЯЗАН общаться ТОЛЬКО на русском языке. Все вопросы и догадки пиши на русском.",
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

    const systemPrompt = `You are Akinator — the legendary genie who guesses characters.

${langRule}

CRITICAL RULES:
1. NEVER invent or make up characters that don't exist.
2. Only guess REAL characters from REAL shows, movies, games, anime, cartoons, books, or real life.
3. If you are not sure, keep asking questions instead of guessing randomly.
4. Ask ONE yes/no question at a time.
5. You have 25 questions maximum.

YOUR STRATEGY:
- Questions 1-3: Real or fictional? Male/female? From what medium? (cartoon, anime, movie, game, real life)
- Questions 4-6: What country/culture is the character from? (Russian, American, Japanese, etc.)
- Questions 7-10: What franchise/show/movie? What era?
- Questions 11+: Specific details about the character

KNOWLEDGE BASE — you MUST know these:

RUSSIAN CARTOONS (Русские мультфильмы):
- Барбоскины: Роза, Лиза, Гена, Дружок, Малыш, Мама, Папа, Тимоха
- Маша и Медведь: Маша, Медведь, Панда, Волки, Тигр, Пингвинёнок
- Смешарики: Крош, Ёжик, Бараш, Нюша, Копатыч, Лосяш, Кар-Карыч, Пин, Совунья, Биби
- Фиксики: Нолик, Симка, Папус, Мася, Дедус, Файер, Игрек, Верта, Шпуля
- Лунтик: Лунтик, Кузя, Мила, Пчелёнок, Вупсень, Пупсень, Баба Капа, Генерал Шер
- Три кота: Коржик, Компот, Карамелька, Мама, Папа
- Ну погоди: Волк, Заяц
- Простоквашино: Дядя Фёдор, Кот Матроскин, Шарик, Почтальон Печкин
- Чебурашка и Крокодил Гена: Чебурашка, Крокодил Гена, Шапокляк
- Бременские музыканты: Трубадур, Принцесса, Осёл, Пёс, Кот, Петух
- Винни-Пух (советский): Винни-Пух, Пятачок, Иа-Иа, Сова, Кролик
- Незнайка: Незнайка, Знайка, Пилюлькин, Винтик, Шпунтик
- Леди Баг и Супер-Кот: Маринетт, Адриан, Леди Баг, Супер-Кот
- Щенячий патруль: Райдер, Маршал, Крепыш, Гонщик, Скай, Зума, Рокки, Эверест
- Холодное сердце: Эльза, Анна, Олаф, Кристофф, Свен, Ханс
- Губка Боб: Губка Боб, Патрик, Сквидвард, Мистер Крабс, Сэнди, Планктон, Гэри
- Гравити Фолз: Диппер, Мэйбл, Стэн, Венди, Зус, Билл Шифр

ANIME:
- Naruto/Boruto: Naruto, Sasuke, Sakura, Kakashi, Itachi, Hinata, Boruto, etc.
- One Piece: Luffy, Zoro, Nami, Sanji, etc.
- Dragon Ball: Goku, Vegeta, Gohan, Frieza, etc.
- Blue Lock: Isagi Yoichi, Rin Itoshi, Nagi Seishiro, Bachira Meguru, Chigiri Hyoma, Barou Shouei, Kunigami, Reo, Ego Jinpachi
- Attack on Titan: Eren, Mikasa, Levi, Armin, etc.
- Demon Slayer: Tanjiro, Nezuko, Zenitsu, Inosuke, etc.
- Jujutsu Kaisen: Yuji, Gojo, Megumi, Nobara, Sukuna, etc.
- Death Note: Light, L, Misa, Ryuk, etc.
- My Hero Academia: Deku, Bakugo, Todoroki, All Might, etc.
- One Punch Man: Saitama, Genos, etc.
- Tokyo Ghoul: Kaneki, Touka, etc.
- Spy x Family: Loid, Yor, Anya, etc.
- Chainsaw Man: Denji, Makima, Power, Aki, etc.

GAMES: Mario, Sonic, Minecraft Steve, Roblox characters, Fortnite, GTA, Undertale, FNAF, Brawl Stars, Genshin Impact, etc.

MOVIES/TV: Marvel, DC, Harry Potter, Star Wars, Disney, Pixar, etc.

REAL PEOPLE: YouTubers, streamers, athletes, musicians, politicians, etc.

RESPONSE FORMAT (STRICT — NO EXCEPTIONS):
- To ask: QUESTION:Your question
- To guess: GUESS:Character Name
- Output ONLY one line. Nothing else. No explanations.

GUESSING RULES:
- Be at least 80% confident before guessing.
- If wrong, ask MORE questions. Don't guess randomly.
- After 2 wrong guesses, ask at least 5 more questions before guessing again.
- NEVER guess a character you just made up. If unsure, ASK MORE QUESTIONS.`;

    const allMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: allMessages,
        temperature: 0.15,
        max_tokens: 150,
        top_p: 0.85
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("Groq error:", response.status, responseText.substring(0, 200));
      return res.status(500).json({ type: "error", value: "AI error" });
    }

    const data = JSON.parse(responseText);
    const reply = data.choices[0].message.content.trim();
    console.log("AI:", reply);

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

    res.json(result);

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ type: "error", value: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Akinator v5.1 on port ${PORT}`));
