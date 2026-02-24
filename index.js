const TelegramBot = require("node-telegram-bot-api");
const fetch = require("node-fetch");

const BOT_TOKEN = process.env.BOT_TOKEN || "8753253331:AAGOZe58YJnHwjJU4i2Gf5aAPwT2rPIuqEU";
const GEMINI_KEY = process.env.GEMINI_KEY || "AIzaSyCTw1olGEPCWZCpgVFRXsgFvwIvTMlSqPI";

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ── 每位用戶的模式記憶 ──
const userMode = {};   // chatId -> modeId
const userTone = {};   // chatId -> tone (formal/sincere/casual)

// ── 模式設定 ──
const MODES = {
  prospect:  { label: "🎯 開發客戶", prompt: "你是台灣頂尖業務銷售顧問。用繁體中文，根據情境生成自然親切、有吸引力的開場白或破冰話術，語氣像真人LINE聊天。不超過4句。\n\n情境：" },
  objection: { label: "🛡️ 處理異議", prompt: "你是台灣頂尖業務銷售顧問，擅長化解客戶異議。先同理客戶感受，再轉化觀點，最後引導決策。語氣真誠不強迫。不超過4句。\n\n情境：" },
  close:     { label: "🤝 促成成交", prompt: "你是台灣頂尖業務銷售顧問，擅長臨門一腳促成成交。根據情境，用自然方式引導客戶做決定。不強迫，但要清楚。不超過4句。\n\n情境：" },
  followup:  { label: "📲 維繫跟進", prompt: "你是台灣頂尖業務銷售顧問，擅長售後維繫與溫度跟進。根據情境，生成讓客戶感受到被重視、自然不做作的跟進訊息。不超過4句。\n\n情境：" },
  reply:     { label: "💬 對話回覆", prompt: "你是台灣頂尖業務銷售顧問。根據客戶說的話，生成自然、高情商、有利於銷售的回覆。不超過4句。\n\n客戶說：" },
  post:      { label: "✍️ 社群發文", prompt: "你是台灣頂尖業務銷售顧問，擅長社群內容行銷。根據主題，生成適合FB/IG/LINE的吸睛業務貼文，有故事性、真實感。不超過6句。\n\n主題：" },
  master_closer:   { label: "🎯 成交戰神", prompt: "你是一位專精「閉環成交法」的銷售教練。用繁體中文台灣商務語氣，語氣強勢有自信，直擊客戶痛點，一步步引導對方說YES。不超過5句。\n\n情境：" },
  master_inquirer: { label: "🔍 提問專家", prompt: "你是一位專精「提問式銷售」的銷售教練。用繁體中文，善用反問句讓客戶自己思考與說服自己。語氣智慧從容。不超過5句。\n\n情境：" },
  master_relator:  { label: "🤝 關係大師", prompt: "你是一位專精「250定律與親和力建立」的銷售教練。用繁體中文，語氣極度真誠溫暖，先建立好感與信任，完全不急於推銷。不超過5句。\n\n情境：" },
  master_wolf:     { label: "🔥 直線說服", prompt: "你是一位專精「直線說服系統」的銷售教練。用繁體中文，語氣充滿自信，製造緊迫感，強調獨特機會。不超過5句。\n\n情境：" },
  love:      { label: "💗 感情話術", prompt: "你是台灣最厲害的感情達人，高情商共情，語氣溫柔且充滿同理心。用繁體中文，根據情境給予真誠的情感支持與回覆。不超過4句。\n\n情境：" },
};

const TONE_SUFFIX = {
  formal:  "\n\n請用【正式專業】語氣回覆：數據、邏輯、ROI導向，像顧問在做簡報。",
  sincere: "\n\n請用【誠懇真心】語氣回覆：先同理感受，再分享真實故事，讓對方感受到你是真心的。",
  casual:  "\n\n請用【白話親切】語氣回覆：像朋友聊天，可以用比喻、幽默、emoji，輕鬆自然。",
};

// ── 呼叫 Gemini API ──
async function callGemini(prompt, text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt + text }] }],
      generationConfig: { maxOutputTokens: 500 },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "（無回覆）";
}

// ── 產生模式選單 ──
function modeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🎯 開發客戶", callback_data: "mode_prospect" }, { text: "🛡️ 處理異議", callback_data: "mode_objection" }],
      [{ text: "🤝 促成成交", callback_data: "mode_close" },    { text: "📲 維繫跟進", callback_data: "mode_followup" }],
      [{ text: "💬 對話回覆", callback_data: "mode_reply" },    { text: "✍️ 社群發文", callback_data: "mode_post" }],
      [{ text: "🎯 成交戰神", callback_data: "mode_master_closer" }, { text: "🔍 提問專家", callback_data: "mode_master_inquirer" }],
      [{ text: "🤝 關係大師", callback_data: "mode_master_relator" }, { text: "🔥 直線說服", callback_data: "mode_master_wolf" }],
      [{ text: "💗 感情話術", callback_data: "mode_love" }],
    ],
  };
}

// ── 產生語氣選單 ──
function toneKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "💼 正式專業", callback_data: "tone_formal" },
        { text: "🙏 誠懇真心", callback_data: "tone_sincere" },
        { text: "😊 白話親切", callback_data: "tone_casual" },
        { text: "🔄 三版本", callback_data: "tone_triple" },
      ],
    ],
  };
}

// ── /start 歡迎訊息 ──
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userMode[chatId] = "prospect";
  userTone[chatId] = "triple";
  bot.sendMessage(chatId,
    `👋 歡迎使用 *神回AI* — 業務×感情×行業話術神器！\n\n` +
    `📌 使用方式：\n` +
    `1️⃣ 用 /模式 選擇情境\n` +
    `2️⃣ 用 /語氣 選擇回覆風格\n` +
    `3️⃣ 直接輸入情境，AI幫你生成話術！\n\n` +
    `目前模式：🎯 開發客戶 ｜ 語氣：🔄 三版本\n\n` +
    `試試看：\n_客戶說已經有在用別人的產品了_`,
    { parse_mode: "Markdown" }
  );
});

// ── /模式 指令 ──
bot.onText(/\/模式|\/mode/, (msg) => {
  bot.sendMessage(msg.chat.id, "請選擇話術模式：", { reply_markup: modeKeyboard() });
});

// ── /語氣 指令 ──
bot.onText(/\/語氣|\/tone/, (msg) => {
  bot.sendMessage(msg.chat.id, "請選擇回覆語氣：", { reply_markup: toneKeyboard() });
});

// ── /說明 指令 ──
bot.onText(/\/說明|\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `📖 *神回AI 使用說明*\n\n` +
    `*指令：*\n` +
    `/模式 — 切換話術情境\n` +
    `/語氣 — 切換回覆風格\n` +
    `/說明 — 顯示此說明\n\n` +
    `*語氣說明：*\n` +
    `💼 正式 — 數據邏輯導向\n` +
    `🙏 誠懇 — 同理心故事\n` +
    `😊 白話 — 朋友聊天風\n` +
    `🔄 三版本 — 同時生成三種\n\n` +
    `直接輸入情境就能生成話術！`,
    { parse_mode: "Markdown" }
  );
});

// ── Callback 按鈕處理 ──
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const data = q.data;
  bot.answerCallbackQuery(q.id);

  if (data.startsWith("mode_")) {
    const modeId = data.replace("mode_", "");
    userMode[chatId] = modeId;
    const m = MODES[modeId];
    bot.sendMessage(chatId, `✅ 已切換到：*${m.label}*\n\n現在輸入情境，我幫你生成話術！`, { parse_mode: "Markdown" });
  } else if (data.startsWith("tone_")) {
    const tone = data.replace("tone_", "");
    userTone[chatId] = tone;
    const labels = { formal:"💼 正式專業", sincere:"🙏 誠懇真心", casual:"😊 白話親切", triple:"🔄 三版本" };
    bot.sendMessage(chatId, `✅ 語氣切換為：*${labels[tone]}*`, { parse_mode: "Markdown" });
  }
});

// ── 主要訊息處理 ──
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text.startsWith("/")) return;

  const modeId = userMode[chatId] || "prospect";
  const tone   = userTone[chatId] || "triple";
  const mode   = MODES[modeId];

  // 發送「正在生成」提示
  const waitMsg = await bot.sendMessage(chatId, `${mode.label} ⏳ 生成中...`);

  try {
    if (tone === "triple") {
      // 三版本同時生成
      const [r1, r2, r3] = await Promise.all([
        callGemini(mode.prompt + TONE_SUFFIX.formal, text),
        callGemini(mode.prompt + TONE_SUFFIX.sincere, text),
        callGemini(mode.prompt + TONE_SUFFIX.casual, text),
      ]);
      const reply =
        `${mode.label}\n\n` +
        `💼 *正式專業版*\n${r1}\n\n` +
        `🙏 *誠懇真心版*\n${r2}\n\n` +
        `😊 *白話親切版*\n${r3}`;
      await bot.deleteMessage(chatId, waitMsg.message_id);
      bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
    } else {
      const suffix = TONE_SUFFIX[tone] || "";
      const reply = await callGemini(mode.prompt + suffix, text);
      const toneLabel = { formal:"💼 正式", sincere:"🙏 誠懇", casual:"😊 白話" }[tone] || "";
      await bot.deleteMessage(chatId, waitMsg.message_id);
      bot.sendMessage(chatId, `${mode.label} ${toneLabel}\n\n${reply}`);
    }
  } catch (e) {
    await bot.deleteMessage(chatId, waitMsg.message_id);
    bot.sendMessage(chatId, `⚠️ 生成失敗：${e.message}\n\n請稍後再試。`);
  }
});

console.log("🚀 神回AI Bot 啟動中...");
