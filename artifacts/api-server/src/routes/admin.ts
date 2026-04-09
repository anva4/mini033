import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { users, products, deals, transactions, categories, reviews, messages } from "@workspace/db/schema";
import { eq, desc, sql, ilike, and, gte, lt } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

// Проверяем isAdmin из БД при каждом запросе — гарантирует немедленное применение смены роли
async function adminFromDbMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as any).userId;
  if (!userId) { res.status(401).json({ message: "Unauthorized" }); return; }
  try {
    const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user?.isAdmin) { res.status(403).json({ message: "Admin only" }); return; }
    next();
  } catch (err) {
    logger.error(err, "Admin DB check error");
    res.status(500).json({ message: "Internal server error" });
  }
}

router.use(authMiddleware, adminFromDbMiddleware);

// ─── STATS ────────────────────────────────────────────────────────────────────

router.get("/stats", async (_req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const todayStart = now - (now % 86400);

    const [
      [{ totalUsers }], [{ totalProducts }], [{ totalDeals }],
      [{ totalRevenue }], [{ pendingWithdrawals }], [{ activeDisputes }],
      [{ todayDeals }], [{ todayRegistrations }], [{ todayVolume }],
    ] = await Promise.all([
      db.select({ totalUsers: sql<number>`count(*)::int` }).from(users),
      db.select({ totalProducts: sql<number>`count(*)::int` }).from(products),
      db.select({ totalDeals: sql<number>`count(*)::int` }).from(deals),
      db.select({ totalRevenue: sql<number>`coalesce(sum(commission::numeric), 0)::float` }).from(deals).where(eq(deals.status, "completed")),
      db.select({ pendingWithdrawals: sql<number>`count(*)::int` }).from(transactions).where(and(eq(transactions.type, "withdrawal"), eq(transactions.status, "pending"))),
      db.select({ activeDisputes: sql<number>`count(*)::int` }).from(deals).where(eq(deals.status, "disputed")),
      db.select({ todayDeals: sql<number>`count(*)::int` }).from(deals).where(gte(deals.createdAt, todayStart)),
      db.select({ todayRegistrations: sql<number>`count(*)::int` }).from(users).where(gte(users.createdAt, todayStart)),
      db.select({ todayVolume: sql<number>`coalesce(sum(commission::numeric), 0)::float` }).from(deals).where(and(eq(deals.status, "completed"), gte(deals.createdAt, todayStart))),
    ]);

    res.json({ totalUsers, totalProducts, totalDeals, totalRevenue, pendingWithdrawals, activeDisputes, todayDeals, todayRegistrations, todayVolume });
  } catch (err) {
    logger.error(err, "Admin stats error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// FIX+NEW: График доходов — доходность по дням за последние N дней
router.get("/stats/revenue", async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt((req.query.days as string) || "30")));
    const now = Math.floor(Date.now() / 1000);
    const result: { date: string; revenue: number; dealsCount: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = now - (now % 86400) - i * 86400;
      const dayEnd = dayStart + 86400;
      const [row] = await db
        .select({
          revenue: sql<number>`coalesce(sum(commission::numeric), 0)::float`,
          dealsCount: sql<number>`count(*)::int`,
        })
        .from(deals)
        .where(and(eq(deals.status, "completed"), gte(deals.createdAt, dayStart), lt(deals.createdAt, dayEnd)));
      const d = new Date(dayStart * 1000);
      result.push({ date: d.toISOString().slice(0, 10), revenue: row?.revenue ?? 0, dealsCount: row?.dealsCount ?? 0 });
    }

    res.json(result);
  } catch (err) {
    logger.error(err, "Admin revenue chart error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── USERS ────────────────────────────────────────────────────────────────────

// FIX: Добавлены total, page, totalPages + фильтрация по banned/verified
router.get("/users", async (req, res) => {
  try {
    const { search, page = "1", limit = "20", banned, verified } = req.query as any;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));

    const conditions: any[] = [];
    if (search) conditions.push(ilike(users.username, `%${search}%`));
    if (banned === "true") conditions.push(eq(users.isBanned, true));
    if (verified === "true") conditions.push(eq(users.isVerified, true));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [usersList, [{ total }]] = await Promise.all([
      db.select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        avatar: users.avatar,
        balance: users.balance,
        frozenBalance: users.frozenBalance,
        totalDeposited: users.totalDeposited,
        totalWithdrawn: users.totalWithdrawn,
        totalVolume: users.totalVolume,
        isAdmin: users.isAdmin,
        isVerified: users.isVerified,
        isBanned: users.isBanned,
        totalSales: users.totalSales,
        totalPurchases: users.totalPurchases,
        rating: users.rating,
        reviewCount: users.reviewCount,
        sellerLevel: users.sellerLevel,
        telegramUsername: users.telegramUsername,
        createdAt: users.createdAt,
        lastActive: users.lastActive,
      }).from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(limitNum)
        .offset((pageNum - 1) * limitNum),
      db.select({ total: sql<number>`count(*)::int` }).from(users).where(where),
    ]);

    res.json({ users: usersList, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    logger.error(err, "Admin list users error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// NEW: Получить детальную информацию о пользователе
router.get("/users/:id", async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.params.id)).limit(1);
    if (!user) { res.status(404).json({ message: "User not found" }); return; }
    const { password: _, twoFACode: __, ...safeUser } = user;

    const [[{ buyerDeals }], [{ sellerDeals }], recentTransactions] = await Promise.all([
      db.select({ buyerDeals: sql<number>`count(*)::int` }).from(deals).where(eq(deals.buyerId, user.id)),
      db.select({ sellerDeals: sql<number>`count(*)::int` }).from(deals).where(eq(deals.sellerId, user.id)),
      db.select().from(transactions).where(eq(transactions.userId, user.id)).orderBy(desc(transactions.createdAt)).limit(10),
    ]);

    res.json({ ...safeUser, buyerDeals, sellerDeals, recentTransactions });
  } catch (err) {
    logger.error(err, "Admin get user error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// FIX: ban возвращает полный объект User + поддержка reason и banUntil
router.post("/users/:id/ban", async (req, res) => {
  try {
    const { banned, reason, banUntilHours } = req.body;
    if (typeof banned !== "boolean") { res.status(400).json({ message: "banned must be boolean" }); return; }
    const now = Math.floor(Date.now() / 1000);
    const banUntil = banUntilHours && banned ? now + banUntilHours * 3600 : null;
    const [updated] = await db.update(users).set({
      isBanned: banned,
      banReason: banned ? (reason || "Нарушение правил") : null,
      banAt: banned ? now : null,
      banUntil: banUntil ?? undefined,
    }).where(eq(users.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ message: "User not found" }); return; }

    // Уведомление забаненному через Telegram
    if (updated.telegramId) {
      const { sendTelegramMessage } = await import("../lib/telegram");
      if (banned) {
        const until = banUntil ? new Date(banUntil * 1000).toLocaleString("ru-RU") : "бессрочно";
        await sendTelegramMessage(updated.telegramId, `🚫 <b>Ваш аккаунт заблокирован</b>\n\n<b>Причина:</b> ${updated.banReason}\n<b>До:</b> ${until}\n\nЕсли считаете это ошибкой, обратитесь в поддержку.`);
      } else {
        await sendTelegramMessage(updated.telegramId, `✅ <b>Ваш аккаунт разблокирован</b>\n\nВы снова можете пользоваться Minions Market.`);
      }
    }

    const { password: _, twoFACode: __, ...safeUser } = updated;
    logger.info({ userId: req.params.id, banned, reason }, "User ban status changed");
    res.json(safeUser);
  } catch (err) {
    logger.error(err, "Ban user error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// FIX: verify возвращает полный объект User + поддержка снятия верификации
router.post("/users/:id/verify", async (req, res) => {
  try {
    const { verified = true } = req.body;
    const [updated] = await db.update(users).set({ isVerified: verified }).where(eq(users.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ message: "User not found" }); return; }
    const { password: _, twoFACode: __, ...safeUser } = updated;
    res.json(safeUser);
  } catch (err) {
    logger.error(err, "Verify user error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// NEW: Изменение роли пользователя (admin/user)
router.post("/users/:id/role", async (req, res) => {
  try {
    const { isAdmin } = req.body;
    if (typeof isAdmin !== "boolean") { res.status(400).json({ message: "isAdmin must be boolean" }); return; }
    const [updated] = await db.update(users).set({ isAdmin }).where(eq(users.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ message: "User not found" }); return; }
    const { password: _, twoFACode: __, ...safeUser } = updated;
    logger.info({ userId: req.params.id, isAdmin }, "User role changed by admin");
    res.json(safeUser);
  } catch (err) {
    logger.error(err, "Set role error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// NEW: Ручная корректировка баланса пользователя
router.post("/users/:id/balance", async (req, res) => {
  try {
    const { amount, type, description } = req.body;
    const amountNum = parseFloat(amount);
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) { res.status(400).json({ message: "Invalid amount" }); return; }
    if (!["add", "deduct"].includes(type)) { res.status(400).json({ message: "type must be add or deduct" }); return; }

    const [user] = await db.select().from(users).where(eq(users.id, req.params.id)).limit(1);
    if (!user) { res.status(404).json({ message: "User not found" }); return; }

    const currentBalance = parseFloat(user.balance);
    const delta = type === "add" ? amountNum : -amountNum;
    const newBalance = Math.max(0, currentBalance + delta);

    const [[updated]] = await Promise.all([
      db.update(users).set({ balance: newBalance.toFixed(2) }).where(eq(users.id, req.params.id)).returning(),
      db.insert(transactions).values({
        userId: req.params.id,
        type: type === "add" ? "admin_credit" : "admin_deduct",
        amount: amountNum.toFixed(2),
        status: "completed",
        description: description || `Admin balance ${type === "add" ? "credit" : "deduct"}`,
        balanceBefore: currentBalance.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
      }),
    ]);

    logger.info({ userId: req.params.id, type, amount: amountNum, newBalance }, "Admin balance adjustment");
    const { password: _, twoFACode: __, ...safeUser } = updated;
    res.json(safeUser);
  } catch (err) {
    logger.error(err, "Balance adjustment error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────

// FIX: добавлены фильтрация, поиск, пагинация с total
router.get("/products", async (req, res) => {
  try {
    const { status, page = "1", limit = "50", search } = req.query as any;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const conditions: any[] = [];
    if (status) conditions.push(eq(products.status, status));
    if (search) conditions.push(ilike(products.title, `%${search}%`));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [prods, [{ total }]] = await Promise.all([
      db.select({
        id: products.id,
        title: products.title,
        price: products.price,
        status: products.status,
        sellerId: products.sellerId,
        category: products.category,
        views: products.views,
        soldCount: products.soldCount,
        createdAt: products.createdAt,
        sellerUsername: users.username,
        sellerAvatar: users.avatar,
      }).from(products)
        .leftJoin(users, eq(products.sellerId, users.id))
        .where(where)
        .orderBy(desc(products.createdAt))
        .limit(limitNum)
        .offset((pageNum - 1) * limitNum),
      db.select({ total: sql<number>`count(*)::int` }).from(products).where(where),
    ]);

    const mapped = prods.map((p) => ({ ...p, seller: { username: p.sellerUsername, avatar: p.sellerAvatar } }));
    res.json({ products: mapped, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    logger.error(err, "Admin list products error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// FIX: возвращает обновлённый product
router.post("/products/:id/moderate", async (req, res) => {
  try {
    const { status, reason } = req.body;
    if (!["active", "rejected", "hidden"].includes(status)) { res.status(400).json({ message: "Invalid status" }); return; }
    const [updated] = await db.update(products).set({ status }).where(eq(products.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ message: "Product not found" }); return; }
    logger.info({ productId: req.params.id, status, reason }, "Product moderated");
    res.json(updated);
  } catch (err) {
    logger.error(err, "Moderate product error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// NEW: Удаление товара администратором
router.delete("/products/:id", async (req, res) => {
  try {
    await db.delete(products).where(eq(products.id, req.params.id));
    logger.info({ productId: req.params.id }, "Product deleted by admin");
    res.status(204).send();
  } catch (err) {
    logger.error(err, "Delete product error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── DEALS ────────────────────────────────────────────────────────────────────

// FIX: Заменены N+1 запросы на JOIN, добавлена пагинация
router.get("/deals", async (req, res) => {
  try {
    const { status, page = "1", limit = "50" } = req.query as any;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const where = status ? eq(deals.status, status) : undefined;

    const [dealsList, [{ total }]] = await Promise.all([
      db.execute(sql`
        SELECT d.id, d.deal_number, d.amount, d.commission, d.seller_amount, d.status,
               d.dispute_reason, d.admin_comment, d.created_at, d.buyer_id, d.seller_id,
               b.username as buyer_username, b.avatar as buyer_avatar,
               s.username as seller_username, s.avatar as seller_avatar
        FROM deals d
        LEFT JOIN users b ON b.id = d.buyer_id
        LEFT JOIN users s ON s.id = d.seller_id
        ${status ? sql`WHERE d.status = ${status}` : sql``}
        ORDER BY d.created_at DESC
        LIMIT ${limitNum} OFFSET ${(pageNum - 1) * limitNum}
      `),
      db.select({ total: sql<number>`count(*)::int` }).from(deals).where(where),
    ]);

    const mapped = (dealsList as any[]).map((d: any) => ({
      id: d.id,
      dealNumber: Number(d.deal_number),
      amount: d.amount,
      commission: d.commission,
      sellerAmount: d.seller_amount,
      status: d.status,
      disputeReason: d.dispute_reason,
      adminComment: d.admin_comment,
      createdAt: Number(d.created_at),
      buyerId: d.buyer_id,
      sellerId: d.seller_id,
      buyer: { username: d.buyer_username, avatar: d.buyer_avatar },
      seller: { username: d.seller_username, avatar: d.seller_avatar },
    }));

    res.json({ deals: mapped, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    logger.error(err, "Admin list deals error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// FIX+NEW: Добавлена опция split (разделить поровну)
router.post("/deals/:id/resolve", async (req, res) => {
  try {
    const { resolution, adminComment } = req.body;
    if (!["refund_buyer", "pay_seller", "split"].includes(resolution)) {
      res.status(400).json({ message: "resolution must be refund_buyer | pay_seller | split" }); return;
    }

    const [deal] = await db.select().from(deals).where(eq(deals.id, req.params.id)).limit(1);
    if (!deal) { res.status(404).json({ message: "Deal not found" }); return; }
    if (!["disputed", "pending"].includes(deal.status)) {
      res.status(400).json({ message: "Deal cannot be resolved in current state" }); return;
    }

    if (resolution === "refund_buyer") {
      await db.update(deals).set({ status: "cancelled", adminComment }).where(eq(deals.id, deal.id));
      const [buyer] = await db.select().from(users).where(eq(users.id, deal.buyerId)).limit(1);
      await db.update(users).set({
        balance: (parseFloat(buyer.balance) + parseFloat(deal.amount)).toFixed(2),
        frozenBalance: Math.max(0, parseFloat(buyer.frozenBalance) - parseFloat(deal.amount)).toFixed(2),
      }).where(eq(users.id, deal.buyerId));
      await db.insert(transactions).values({
        userId: deal.buyerId, type: "refund", amount: deal.amount, status: "completed",
        description: `Возврат по сделке #${deal.dealNumber} (решение администратора)`,
      });
    } else if (resolution === "pay_seller") {
      await db.update(deals).set({ status: "completed", adminComment }).where(eq(deals.id, deal.id));
      const [[seller], [buyer]] = await Promise.all([
        db.select().from(users).where(eq(users.id, deal.sellerId)).limit(1),
        db.select().from(users).where(eq(users.id, deal.buyerId)).limit(1),
      ]);
      await Promise.all([
        db.update(users).set({
          balance: (parseFloat(seller.balance) + parseFloat(deal.sellerAmount)).toFixed(2),
          totalSales: seller.totalSales + 1,
        }).where(eq(users.id, deal.sellerId)),
        db.update(users).set({
          frozenBalance: Math.max(0, parseFloat(buyer.frozenBalance) - parseFloat(deal.amount)).toFixed(2),
          totalPurchases: buyer.totalPurchases + 1,
        }).where(eq(users.id, deal.buyerId)),
        db.insert(transactions).values({
          userId: deal.sellerId, type: "sale_revenue", amount: deal.sellerAmount, status: "completed",
          description: `Доход от сделки #${deal.dealNumber} (решение администратора)`,
        }),
      ]);
    } else {
      // split — возвращаем покупателю 50%, продавцу 50%
      const halfBuyer = (parseFloat(deal.amount) / 2).toFixed(2);
      const halfSeller = (parseFloat(deal.sellerAmount) / 2).toFixed(2);
      await db.update(deals).set({ status: "completed", adminComment }).where(eq(deals.id, deal.id));
      const [[buyer], [seller]] = await Promise.all([
        db.select().from(users).where(eq(users.id, deal.buyerId)).limit(1),
        db.select().from(users).where(eq(users.id, deal.sellerId)).limit(1),
      ]);
      await Promise.all([
        db.update(users).set({
          balance: (parseFloat(buyer.balance) + parseFloat(halfBuyer)).toFixed(2),
          frozenBalance: Math.max(0, parseFloat(buyer.frozenBalance) - parseFloat(deal.amount)).toFixed(2),
        }).where(eq(users.id, deal.buyerId)),
        db.update(users).set({
          balance: (parseFloat(seller.balance) + parseFloat(halfSeller)).toFixed(2),
        }).where(eq(users.id, deal.sellerId)),
        db.insert(transactions).values([
          { userId: deal.buyerId, type: "refund", amount: halfBuyer, status: "completed", description: `Частичный возврат по сделке #${deal.dealNumber}` },
          { userId: deal.sellerId, type: "sale_revenue", amount: halfSeller, status: "completed", description: `Частичный доход от сделки #${deal.dealNumber}` },
        ]),
      ]);
    }

    logger.info({ dealId: deal.id, resolution, adminComment }, "Deal resolved by admin");
    res.json({ message: "Resolved" });
  } catch (err) {
    logger.error(err, "Resolve deal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── WITHDRAWALS ──────────────────────────────────────────────────────────────

// FIX: добавлен JOIN с users для username/avatar, фильтр по status
router.get("/withdrawals", async (req, res) => {
  try {
    const { status = "pending" } = req.query as any;
    const rows = await db.execute(sql`
      SELECT t.id, t.user_id, t.amount, t.withdraw_method, t.withdraw_details,
             t.description, t.status, t.created_at, u.username, u.avatar
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.type = 'withdrawal' AND t.status = ${status}
      ORDER BY t.created_at ASC
    `);
    const mapped = (rows as any[]).map((t: any) => ({
      id: t.id, userId: t.user_id, amount: t.amount,
      withdrawMethod: t.withdraw_method, withdrawDetails: t.withdraw_details,
      description: t.description, status: t.status, createdAt: Number(t.created_at),
      user: { username: t.username, avatar: t.avatar },
    }));
    res.json(mapped);
  } catch (err) {
    logger.error(err, "Admin withdrawals error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// FIX: добавлен note, корректное восстановление баланса при reject
router.post("/withdrawals/:id/process", async (req, res) => {
  try {
    const { action, note } = req.body;
    if (!["approve", "reject"].includes(action)) { res.status(400).json({ message: "action must be approve or reject" }); return; }

    const [tx] = await db.select().from(transactions).where(eq(transactions.id, req.params.id)).limit(1);
    if (!tx || tx.status !== "pending") { res.status(400).json({ message: "Transaction not found or not pending" }); return; }

    const newDesc = note ? `${tx.description ?? ""} — ${action === "approve" ? "Одобрено" : "Отклонено"}: ${note}` : tx.description;

    if (action === "approve") {
      await db.update(transactions).set({ status: "completed", description: newDesc }).where(eq(transactions.id, tx.id));
      const [user] = await db.select().from(users).where(eq(users.id, tx.userId)).limit(1);
      await db.update(users).set({
        totalWithdrawn: (parseFloat(user.totalWithdrawn) + parseFloat(tx.amount)).toFixed(2),
      }).where(eq(users.id, tx.userId));
    } else {
      // Отклонение: возвращаем средства на баланс
      await db.update(transactions).set({ status: "cancelled", description: newDesc }).where(eq(transactions.id, tx.id));
      const [user] = await db.select().from(users).where(eq(users.id, tx.userId)).limit(1);
      await db.update(users).set({
        balance: (parseFloat(user.balance) + parseFloat(tx.amount)).toFixed(2),
      }).where(eq(users.id, tx.userId));
    }

    logger.info({ txId: tx.id, action, note }, "Withdrawal processed by admin");
    res.json({ message: `Withdrawal ${action}ed` });
  } catch (err) {
    logger.error(err, "Process withdrawal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

// NEW: Все транзакции платформы с фильтрацией
router.get("/transactions", async (req, res) => {
  try {
    const { type, status, page = "1", limit = "50", userId } = req.query as any;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));

    const conditions: any[] = [];
    if (type) conditions.push(eq(transactions.type, type));
    if (status) conditions.push(eq(transactions.status, status));
    if (userId) conditions.push(eq(transactions.userId, userId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [txList, [{ total }]] = await Promise.all([
      db.execute(sql`
        SELECT t.id, t.user_id, t.type, t.amount, t.currency, t.status,
               t.description, t.gateway_type, t.withdraw_method,
               t.balance_before, t.balance_after, t.created_at, u.username
        FROM transactions t
        LEFT JOIN users u ON u.id = t.user_id
        ${where ? sql`WHERE ${where}` : sql``}
        ORDER BY t.created_at DESC
        LIMIT ${limitNum} OFFSET ${(pageNum - 1) * limitNum}
      `),
      db.select({ total: sql<number>`count(*)::int` }).from(transactions).where(where),
    ]);

    const mapped = (txList as any[]).map((t: any) => ({
      id: t.id, userId: t.user_id, type: t.type, amount: t.amount,
      currency: t.currency, status: t.status, description: t.description,
      gatewayType: t.gateway_type, withdrawMethod: t.withdraw_method,
      balanceBefore: t.balance_before, balanceAfter: t.balance_after,
      createdAt: Number(t.created_at), username: t.username,
    }));

    res.json({ transactions: mapped, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    logger.error(err, "Admin transactions error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── CATEGORIES ───────────────────────────────────────────────────────────────

router.post("/categories", async (req, res) => {
  try {
    const { name, slug, icon, sortOrder } = req.body;
    if (!name || !slug) { res.status(400).json({ message: "Missing name/slug" }); return; }
    const [cat] = await db.insert(categories).values({ name, slug, icon, sortOrder: sortOrder || 0 }).returning();
    res.status(201).json(cat);
  } catch (err) {
    logger.error(err, "Create category error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/categories/:id", async (req, res) => {
  try {
    const { name, slug, icon, sortOrder, isActive } = req.body;
    const [cat] = await db.update(categories).set({
      ...(name ? { name } : {}),
      ...(slug ? { slug } : {}),
      ...(icon !== undefined ? { icon } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    }).where(eq(categories.id, req.params.id)).returning();
    if (!cat) { res.status(404).json({ message: "Category not found" }); return; }
    res.json(cat);
  } catch (err) {
    logger.error(err, "Update category error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    await db.delete(categories).where(eq(categories.id, req.params.id));
    res.status(204).send();
  } catch (err) {
    logger.error(err, "Delete category error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── REVIEWS ──────────────────────────────────────────────────────────────────

// NEW: Список всех отзывов
router.get("/reviews", async (req, res) => {
  try {
    const { page = "1", limit = "50" } = req.query as any;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));

    const [reviewList, [{ total }]] = await Promise.all([
      db.execute(sql`
        SELECT r.id, r.rating, r.comment, r.created_at, r.deal_id,
               a.id as reviewer_id, a.username as reviewer_username, a.avatar as reviewer_avatar,
               s.id as seller_id, s.username as seller_username
        FROM reviews r
        LEFT JOIN users a ON a.id = r.reviewer_id
        LEFT JOIN users s ON s.id = r.seller_id
        ORDER BY r.created_at DESC
        LIMIT ${limitNum} OFFSET ${(pageNum - 1) * limitNum}
      `),
      db.select({ total: sql<number>`count(*)::int` }).from(reviews),
    ]);

    const mapped = (reviewList as any[]).map((r: any) => ({
      id: r.id, rating: Number(r.rating), comment: r.comment,
      createdAt: Number(r.created_at), dealId: r.deal_id,
      reviewer: { id: r.reviewer_id, username: r.reviewer_username, avatar: r.reviewer_avatar },
      seller: { id: r.seller_id, username: r.seller_username },
    }));

    res.json({ reviews: mapped, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    logger.error(err, "Admin reviews error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// NEW: Удаление отзыва
router.delete("/reviews/:id", async (req, res) => {
  try {
    await db.delete(reviews).where(eq(reviews.id, req.params.id));
    logger.info({ reviewId: req.params.id }, "Review deleted by admin");
    res.status(204).send();
  } catch (err) {
    logger.error(err, "Delete review error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── BROADCAST ────────────────────────────────────────────────────────────────

// NEW: Рассылка сообщений пользователям
router.post("/broadcast", async (req, res) => {
  try {
    const adminId = (req as any).userId;
    const { text, targetUserId } = req.body;
    if (!text?.trim()) { res.status(400).json({ message: "Message text required" }); return; }

    if (targetUserId) {
      await db.insert(messages).values({ senderId: adminId, receiverId: targetUserId, text: text.trim() });
      res.json({ sent: 1 });
    } else {
      const allUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.isBanned, false), eq(users.isAdmin, false)));

      if (allUsers.length === 0) { res.json({ sent: 0 }); return; }

      // Вставка партиями по 100
      const rows = allUsers.map((u) => ({ senderId: adminId, receiverId: u.id, text: text.trim() }));
      let sent = 0;
      for (let i = 0; i < rows.length; i += 100) {
        await db.insert(messages).values(rows.slice(i, i + 100));
        sent += rows.slice(i, i + 100).length;
      }
      logger.info({ adminId, sent }, "Admin broadcast message sent");
      res.json({ sent });
    }
  } catch (err) {
    logger.error(err, "Broadcast error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
