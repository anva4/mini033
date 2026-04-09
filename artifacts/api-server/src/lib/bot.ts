import { db } from "@workspace/db";
import { authCodes, users, products, deals, transactions } from "@workspace/db/schema";
import { eq, and, gt, isNull, desc, sql } from "drizzle-orm";
import { logger } from "./logger";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Только владелец (ваш Telegram ID) может использовать админ команды в боте
const OWNER_TELEGRAM_ID = process.env.TELEGRAM_OWNER_ID;

export async function setupWebhook() {
  if (!BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set, skipping webhook setup");
    return;
  }
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    logger.warn("APP_URL not set, skipping webhook setup");
    return;
  }
  try {
    const webhookUrl = `${appUrl}/api/bot/webhook`;
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, drop_pending_updates: true }),
    });
    const data = await res.json() as { ok: boolean; [key: string]: unknown };
    if (data.ok) {
      logger.info({ webhookUrl }, "Telegram webhook set successfully");
    } else {
      logger.error({ data }, "Failed to set Telegram webhook");
    }
  } catch (err) {
    logger.error(err, "Error setting Telegram webhook");
  }
}

export async function sendMessage(chatId: number | string, text: string, extra?: object) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
    });
  } catch (err) {
    logger.error(err, "sendMessage error");
  }
}

export async function handleBotUpdate(update: any) {
  try {
    const message = update?.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const from = message.from;
    const text = message.text.trim();
    const telegramUsername = (from?.username || "").toLowerCase().replace(/^@/, "");

    if (text.startsWith("/start") || text.startsWith("/code")) {
      const param = text.split(" ")[1]?.toLowerCase().replace(/^@/, "") || "";
      const targetUsername = param || telegramUsername;

      if (!targetUsername) {
        await sendMessage(chatId, "❌ Не удалось определить пользователя.\n\nВернитесь на сайт и нажмите кнопку <b>«Получить код»</b>.");
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const [authCode] = await db
        .select()
        .from(authCodes)
        .where(and(eq(authCodes.telegramUsername, targetUsername), gt(authCodes.expiresAt, now), isNull(authCodes.usedAt)))
        .orderBy(desc(authCodes.createdAt))
        .limit(1);

      if (!authCode) {
        const appUrl = process.env.APP_URL || "сайт";
        await sendMessage(chatId,
          `❌ Код не найден или истёк.\n\n` +
          `Вернитесь на <a href="${appUrl}">${appUrl}</a>, введите @${targetUsername} и нажмите «Получить код», затем снова откройте бота.`
        );
        return;
      }

      await db.update(authCodes).set({ telegramId: String(from.id) }).where(eq(authCodes.id, authCode.id));

      const minutesLeft = Math.ceil((authCode.expiresAt - now) / 60);
      await sendMessage(chatId,
        `✅ Ваш код для регистрации на <b>Minions Market</b>:\n\n` +
        `<b>${authCode.code}</b>\n\n` +
        `Введите его на сайте в поле «Код». Действует ещё ${minutesLeft} мин.\n\n` +
        `⚠️ Никому не сообщайте этот код.`
      );
      return;
    }

    if (text.startsWith("/2fa")) {
      const [user] = await db.select().from(users).where(and(eq(users.telegramId, String(from.id)), eq(users.twoFAEnabled, true))).limit(1);
      if (user) {
        const code = Math.random().toString().slice(2, 8);
        const expiresAt = Math.floor(Date.now() / 1000) + 300;
        await db.update(users).set({ twoFACode: code, twoFAExpires: expiresAt }).where(eq(users.id, user.id));
        await sendMessage(chatId, `🔐 Ваш код подтверждения:\n\n<b>${code}</b>\n\nДействует 5 минут.`);
      } else {
        await sendMessage(chatId, "❌ 2FA не активирована. Включите её в настройках профиля.");
      }
      return;
    }

    // Admin commands — только для владельца
    if (text.startsWith("/")) {
      await handleAdminCommand(chatId, text, String(from.id));
      return;
    }

    // Default welcome
    const appUrl = process.env.APP_URL || "сайт";
    await sendMessage(chatId,
      `👋 Привет! Я бот <b>Minions Market</b>.\n\n` +
      `🔑 Чтобы получить код регистрации:\n` +
      `1. Перейдите на <a href="${appUrl}">${appUrl}</a>\n` +
      `2. Введите ваш Telegram @username\n` +
      `3. Нажмите кнопку <b>«Получить код»</b>\n\n` +
      `📋 Команды: /help`
    );
  } catch (err) {
    logger.error(err, "Bot update error");
  }
}

async function handleAdminCommand(chatId: number | string, text: string, telegramId: string) {
  try {
    if (!OWNER_TELEGRAM_ID) {
      await sendMessage(chatId, "⚠️ TELEGRAM_OWNER_ID не настроен.");
      return;
    }
    if (telegramId !== OWNER_TELEGRAM_ID) {
      await sendMessage(chatId, "❌ Доступ запрещён.");
      return;
    }

    const parts = text.split(" ");
    const command = parts[0].toLowerCase();

    switch (command) {
      case "/help": {
        await sendMessage(chatId,
          `📋 <b>Команды администратора:</b>\n\n` +
          `/stats — общая статистика\n` +
          `/user @username — инфо о пользователе\n` +
          `/ban @username [причина] — заблокировать\n` +
          `/unban @username — разблокировать\n` +
          `/products [page] — список товаров\n` +
          `/deals [page] — список сделок\n` +
          `/withdrawals — заявки на вывод\n` +
          `/broadcast текст — рассылка всем\n` +
          `/setadmin @username — выдать права админа\n` +
          `/removeadmin @username — снять права\n` +
          `/help — эта справка`
        );
        break;
      }

      case "/stats": {
        const now = Math.floor(Date.now() / 1000);
        const todayStart = now - (now % 86400);
        const [[{ totalUsers }], [{ totalProducts: tp }], [{ totalDeals: td }], [{ totalRevenue }], [{ bannedUsers }], [{ todayReg }], [{ pendingW }]] = await Promise.all([
          db.select({ totalUsers: sql<number>`count(*)::int` }).from(users),
          db.select({ totalProducts: sql<number>`count(*)::int` }).from(products).where(eq(products.status, "active")),
          db.select({ totalDeals: sql<number>`count(*)::int` }).from(deals).where(eq(deals.status, "completed")),
          db.select({ totalRevenue: sql<number>`coalesce(sum(commission::numeric),0)::float` }).from(deals).where(eq(deals.status, "completed")),
          db.select({ bannedUsers: sql<number>`count(*)::int` }).from(users).where(eq(users.isBanned, true)),
          db.select({ todayReg: sql<number>`count(*)::int` }).from(users).where(sql`created_at >= ${todayStart}`),
          db.select({ pendingW: sql<number>`count(*)::int` }).from(transactions).where(and(eq(transactions.type, "withdrawal"), eq(transactions.status, "pending"))),
        ]);
        await sendMessage(chatId,
          `📊 <b>Статистика Minions Market</b>\n\n` +
          `👥 Пользователей: <b>${totalUsers}</b> (забанено: ${bannedUsers})\n` +
          `🆕 Новые сегодня: <b>${todayReg}</b>\n` +
          `📦 Активных товаров: <b>${tp}</b>\n` +
          `🤝 Сделок выполнено: <b>${td}</b>\n` +
          `💰 Общий доход: <b>${Number(totalRevenue).toFixed(2)} ₽</b>\n` +
          `⏳ Заявок на вывод: <b>${pendingW}</b>\n` +
          `📅 ${new Date().toLocaleString("ru-RU")}`
        );
        break;
      }

      case "/user": {
        const username = parts[1]?.replace(/^@/, "");
        if (!username) { await sendMessage(chatId, "❌ Укажите username: /user @username"); return; }
        const [u] = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (!u) { await sendMessage(chatId, `❌ @${username} не найден.`); return; }
        await sendMessage(chatId,
          `👤 <b>@${u.username}</b>\n\n` +
          `🆔 ID: <code>${u.id}</code>\n` +
          `📱 Telegram: ${u.telegramUsername ? "@" + u.telegramUsername : "—"}\n` +
          `💰 Баланс: <b>${u.balance} ₽</b>\n` +
          `📦 Продаж: ${u.totalSales} | Покупок: ${u.totalPurchases}\n` +
          `⭐ Рейтинг: ${u.rating} (${u.reviewCount} отз.)\n` +
          `🛡 Администратор: ${u.isAdmin ? "Да" : "Нет"}\n` +
          `✅ Верификация: ${u.isVerified ? "Да" : "Нет"}\n` +
          `🚫 Забанен: ${u.isBanned ? `Да (${u.banReason || "—"})` : "Нет"}\n` +
          `📅 Регистрация: ${new Date(u.createdAt * 1000).toLocaleDateString("ru-RU")}`
        );
        break;
      }

      case "/ban": {
        const username = parts[1]?.replace(/^@/, "");
        const reason = parts.slice(2).join(" ") || "Нарушение правил";
        if (!username) { await sendMessage(chatId, "❌ Укажите username: /ban @username [причина]"); return; }
        const [u] = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (!u) { await sendMessage(chatId, `❌ @${username} не найден.`); return; }
        const now = Math.floor(Date.now() / 1000);
        await db.update(users).set({ isBanned: true, banReason: reason, banAt: now }).where(eq(users.id, u.id));
        await sendMessage(chatId, `✅ @${username} заблокирован.\nПричина: ${reason}`);
        if (u.telegramId) {
          await sendMessage(u.telegramId,
            `🚫 <b>Ваш аккаунт заблокирован</b>\n\n` +
            `<b>Причина:</b> ${reason}\n` +
            `<b>Дата:</b> ${new Date().toLocaleString("ru-RU")}\n\n` +
            `Если считаете это ошибкой, обратитесь в поддержку.`
          );
        }
        break;
      }

      case "/unban": {
        const username = parts[1]?.replace(/^@/, "");
        if (!username) { await sendMessage(chatId, "❌ Укажите username: /unban @username"); return; }
        const [u] = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (!u) { await sendMessage(chatId, `❌ @${username} не найден.`); return; }
        await db.update(users).set({ isBanned: false, banReason: null, banAt: undefined, banUntil: undefined }).where(eq(users.id, u.id));
        await sendMessage(chatId, `✅ @${username} разблокирован.`);
        if (u.telegramId) {
          await sendMessage(u.telegramId, `✅ <b>Ваш аккаунт разблокирован</b>\n\nВы снова можете пользоваться Minions Market.`);
        }
        break;
      }

      case "/setadmin": {
        const username = parts[1]?.replace(/^@/, "");
        if (!username) { await sendMessage(chatId, "❌ Укажите username: /setadmin @username"); return; }
        const [u] = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (!u) { await sendMessage(chatId, `❌ @${username} не найден.`); return; }
        await db.update(users).set({ isAdmin: true }).where(eq(users.id, u.id));
        await sendMessage(chatId, `✅ @${username} теперь администратор.`);
        if (u.telegramId) {
          await sendMessage(u.telegramId, `🛡 <b>Вам выданы права администратора</b> на Minions Market!\n\nПерезайдите в аккаунт, чтобы изменения вступили в силу.`);
        }
        break;
      }

      case "/removeadmin": {
        const username = parts[1]?.replace(/^@/, "");
        if (!username) { await sendMessage(chatId, "❌ Укажите username: /removeadmin @username"); return; }
        const [u] = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (!u) { await sendMessage(chatId, `❌ @${username} не найден.`); return; }
        await db.update(users).set({ isAdmin: false }).where(eq(users.id, u.id));
        await sendMessage(chatId, `✅ Права администратора у @${username} сняты.`);
        break;
      }

      case "/products": {
        const page = parseInt(parts[1] || "1");
        const offset = (page - 1) * 10;
        const prods = await db.select({ id: products.id, title: products.title, price: products.price, status: products.status })
          .from(products).orderBy(desc(products.createdAt)).limit(10).offset(offset);
        if (!prods.length) { await sendMessage(chatId, "📦 Нет товаров."); return; }
        const lines = prods.map((p, i) => `${offset + i + 1}. <b>${p.title}</b> — ${p.price}₽ [${p.status}]`).join("\n");
        await sendMessage(chatId, `📦 <b>Товары (стр. ${page}):</b>\n\n${lines}`);
        break;
      }

      case "/deals": {
        const page = parseInt(parts[1] || "1");
        const offset = (page - 1) * 10;
        const dealList = await db.select({ id: deals.id, status: deals.status, price: deals.price })
          .from(deals).orderBy(desc(deals.createdAt)).limit(10).offset(offset);
        if (!dealList.length) { await sendMessage(chatId, "🤝 Нет сделок."); return; }
        const lines = dealList.map((d, i) => `${offset + i + 1}. ${d.status} — ${d.price}₽`).join("\n");
        await sendMessage(chatId, `🤝 <b>Сделки (стр. ${page}):</b>\n\n${lines}`);
        break;
      }

      case "/withdrawals": {
        const pending = await db.select({ id: transactions.id, amount: transactions.amount })
          .from(transactions)
          .where(and(eq(transactions.type, "withdrawal"), eq(transactions.status, "pending")))
          .orderBy(desc(transactions.createdAt))
          .limit(10);
        if (!pending.length) { await sendMessage(chatId, "✅ Нет заявок на вывод."); return; }
        const lines = pending.map((t, i) => `${i + 1}. ${t.amount}₽ — ID: <code>${t.id}</code>`).join("\n");
        await sendMessage(chatId, `💳 <b>Заявки на вывод (${pending.length}):</b>\n\n${lines}\n\nОбработайте в панели администратора.`);
        break;
      }

      case "/broadcast": {
        const broadcastText = parts.slice(1).join(" ");
        if (!broadcastText.trim()) { await sendMessage(chatId, "❌ Укажите текст: /broadcast текст"); return; }
        const allUsers = await db.select({ telegramId: users.telegramId }).from(users).where(and(eq(users.isBanned, false), eq(users.isAdmin, false)));
        let sent = 0;
        for (const u of allUsers) {
          if (u.telegramId) {
            try {
              await sendMessage(u.telegramId, `📢 <b>Сообщение от администрации Minions Market:</b>\n\n${broadcastText}`);
              sent++;
            } catch {}
          }
        }
        await sendMessage(chatId, `✅ Рассылка отправлена ${sent} пользователям.`);
        break;
      }

      default: {
        await sendMessage(chatId, `❓ Неизвестная команда. Напишите /help для справки.`);
      }
    }
  } catch (err) {
    logger.error(err, "Admin command error");
    await sendMessage(chatId, "❌ Ошибка выполнения команды.");
  }
}
