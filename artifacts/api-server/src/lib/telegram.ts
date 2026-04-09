import { logger } from "./logger";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set, skipping message");
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    return res.ok;
  } catch (err) {
    logger.error(err, "Failed to send Telegram message");
    return false;
  }
}

export function verifyTelegramWebAppData(initData: string): { user?: any; valid: boolean } {
  if (!BOT_TOKEN) return { valid: false };
  try {
    const crypto = require("crypto");
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    params.delete("hash");
    const entries = Array.from(params.entries());
    entries.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    if (computedHash !== hash) return { valid: false };
    const userStr = params.get("user");
    const user = userStr ? JSON.parse(userStr) : null;
    return { user, valid: true };
  } catch {
    return { valid: false };
  }
}

export async function notifyAdmin(text: string) {
  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (adminChatId) {
    await sendTelegramMessage(adminChatId, `🔔 <b>Admin notification</b>\n${text}`);
  }
}
