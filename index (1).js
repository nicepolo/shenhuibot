const TelegramBot = require("node-telegram-bot-api");
const fetch = require("node-fetch");

const BOT_TOKEN     = process.env.BOT_TOKEN     || "8753253331:AAGOZe58YJnHwjJU4i2Gf5aAPwT2rPIuqEU";
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || "sk-ant-api03-j2E...0AAA";
const WEBAPP_URL    = process.env.WEBAPP_URL    || "https://nicepolo.github.io/shenhuiai";

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const userMode = {};
const userTone = {};

const MODES = {
  prospect:        { label: "🎯 開發客戶",  prompt: "你是台灣頂尖業務銷售顧問。用繁體中文，根據情境生成自然親切、有吸引力的開場白或破冰話術，語氣像真人LINE聊天。不超過4句。\n\n情境：" },
  objection:       { label: "🛡️ 處理異議", prompt: "你是台灣頂尖業務銷售顧問，擅長化解客戶異議。先同理客戶感受，再轉化觀點，最後引導決策。語氣真誠不強迫。不超過4句。\n\n情境：" },
  close:           { label: "🤝 促成成交",  prompt: "你是台灣頂尖業務銷售顧問，擅長臨門一腳促成成交。根據情境，用自然方式引導客戶做決定。不強迫，但要清楚。不超過4句。\n\n情境：" },
  followup:        { label: "📲 維繫跟進",  prompt: "你是台灣頂尖業務銷售顧問，擅長售後維繫與溫度跟進。根據情境，生成讓客戶感受到被重視、自然不做作的跟進訊息。不超過4句。\n\n情境：" },
  reply:           { label: "💬 對話回覆",  prompt: "你是台灣頂尖業務銷售顧問。根據客戶說的話，生成自然、高情商、有利於銷售的回覆。不超過4句。\n\n客戶說：" },
  post:            { label: "✍️ 社群發文",  prompt: "你是台灣頂尖業務銷售顧問，擅長社群內容行銷。根據主題，生成適合FB/IG/LINE的吸睛業務貼文。不超過6句。\n\n主題：" },
  master_closer:   { label: "🎯 成交戰神",  prompt: "你是一位專精「閉環成交法」的銷售教練。用繁體中文，語氣強勢有自信，直擊客戶痛點，一步步引導對方說YES。不超過5句。\n\n情境：" },
  master_inquirer: { label: "🔍 提問專家",  prompt: "你是一位專精「提問式銷售」的銷售教練。用繁體中文，善用反問句讓客戶自己思考與說服自己。不超過5句。\n\n情境：" },
  master_relator:  { label: "🤝 關係大師",  prompt: "你是一位專精「250定律」的銷售教練。用繁體中文，語氣極度真誠溫暖，先建立好感與信任。不超過5句。\n\n情境：" },
  master_wolf:     { label: "🔥 直線說服",  prompt: "你是一位專精「直線說服系統」的銷售教練。用繁體中文，語氣充滿自信，製造緊迫感。不超過5句。\n\n情境：" },
  love:            { label: "💗 感情話術",  prompt: "你是台灣最厲害的感情達人。用繁體中文，語氣溫柔且充滿同理心，給予真誠的情感支持與回覆。不超過4句。\n\n情境：" },
};

const TONE_SUFFIX = {
  formal:  "\n\n請用【正式專業】語氣：數據、邏輯、ROI導向。",
  sincere: "\n\n請用【誠懇真心】語氣：先同理感受，再分享真實故事。",
  casual:  "\n\n請用【白話親切】語氣：像朋友聊天，可以用比喻、emoji。",
};

// ── Anthropic API ──
async function callClaude(prompt, text) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt + text }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
  return data.content?.[0]?.text || "（無回覆）";
}

function mainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🚀 打開神回AI完整介面", web_app: { url: WEBAPP_URL } }],
      [{ text: "🎯 開發客戶", callback_data: "mode_prospect" }, { text: "🛡️ 處理異議", callback_data: "mode_objection" }],
      [{ text: "🤝 促成成交", callback_data: "mode_close" },    { text: "📲 維繫跟進", callback_data: "mode_followup" }],
      [{ text: "💬 對話回覆", callback_data: "mode_reply" },    { text: "✍️ 社群發文", callback_data: "mode_post" }],
      [{ text: "🎯 成交戰神", callback_data: "mode_master_closer" }, { text: "🔍 提問專家", callback_data: "mode_master_inquirer" }],
      [{ text: "🤝 關係大師", callback_data: "mode_master_relator" }, { text: "🔥 直線說服", callback_data: "mode_master_wolf" }],
      [{ text: "💗 感情話術", callback_data: "mode_love" }],
    ],
  };
}

function toneKeyboard() {
  return {
    inline_keyboard: [[
      { text: "💼 正式", callback_data: "tone_formal" },
      { text: "🙏 誠懇", callback_data: "tone_sincere" },
      { text: "😊 白話", callback_data: "tone_casual" },
      { text: "🔄 三版本", callback_data: "tone_triple" },
    ]],
  };
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userMode[chatId] = "prospect";
  userTone[chatId] = "triple";
  bot.sendMessage(chatId,
    `👋 歡迎使用 *神回AI*\n業務 × 感情 × 行業話術神器！\n\n` +
    `🚀 點下方按鈕打開*完整介面*（推薦）\n` +
    `💬 或直接輸入情境快速生成話術\n\n` +
    `目前：🎯 開發客戶 ｜ 🔄 三版本`,
    { parse_mode: "Markdown", reply_markup: mainKeyboard() }
  );
});

bot.onText(/\/模式|\/mode/, (msg) => {
  bot.sendMessage(msg.chat.id, "選擇話術模式：", { reply_markup: mainKeyboard() });
});

bot.onText(/\/語氣|\/tone/, (msg) => {
  bot.sendMessage(msg.chat.id, "選擇回覆語氣：", { reply_markup: toneKeyboard() });
});

bot.onText(/\/說明|\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `📖 *神回AI 使用說明*\n\n` +
    `*🚀 最佳體驗：* 點「打開完整介面」\n\n` +
    `*⚡ 快速模式：*\n` +
    `/模式 — 切換話術情境\n` +
    `/語氣 — 切換回覆風格\n` +
    `直接輸入情境 → 立即生成`,
    { parse_mode: "Markdown", reply_markup: mainKeyboard() }
  );
});

bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const data = q.data;
  bot.answerCallbackQuery(q.id);
  if (data.startsWith("mode_")) {
    const modeId = data.replace("mode_", "");
    userMode[chatId] = modeId;
    bot.sendMessage(chatId, `✅ *${MODES[modeId].label}*\n\n輸入情境，AI幫你生成話術！`, { parse_mode: "Markdown" });
  } else if (data.startsWith("tone_")) {
    const tone = data.replace("tone_", "");
    userTone[chatId] = tone;
    const labels = { formal:"💼 正式", sincere:"🙏 誠懇", casual:"😊 白話", triple:"🔄 三版本" };
    bot.sendMessage(chatId, `✅ 語氣：*${labels[tone]}*`, { parse_mode: "Markdown" });
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text.startsWith("/")) return;

  const modeId = userMode[chatId] || "prospect";
  const tone   = userTone[chatId] || "triple";
  const mode   = MODES[modeId];
  const waitMsg = await bot.sendMessage(chatId, `${mode.label} ⏳ 生成中...`);

  try {
    if (tone === "triple") {
      const [r1, r2, r3] = await Promise.all([
        callClaude(mode.prompt + TONE_SUFFIX.formal,  text),
        callClaude(mode.prompt + TONE_SUFFIX.sincere, text),
        callClaude(mode.prompt + TONE_SUFFIX.casual,  text),
      ]);
      await bot.deleteMessage(chatId, waitMsg.message_id);
      bot.sendMessage(chatId,
        `${mode.label}\n\n💼 *正式版*\n${r1}\n\n🙏 *誠懇版*\n${r2}\n\n😊 *白話版*\n${r3}`,
        { parse_mode: "Markdown" }
      );
    } else {
      const reply = await callClaude(mode.prompt + (TONE_SUFFIX[tone] || ""), text);
      await bot.deleteMessage(chatId, waitMsg.message_id);
      bot.sendMessage(chatId, `${mode.label}\n\n${reply}`);
    }
  } catch (e) {
    await bot.deleteMessage(chatId, waitMsg.message_id);
    bot.sendMessage(chatId, `⚠️ ${e.message}`);
  }
});

console.log("🚀 神回AI Bot 啟動！(Anthropic)");
