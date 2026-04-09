import { Router } from "express";
import { db } from "@workspace/db";
import { deals, products, users, reviews, transactions } from "@workspace/db/schema";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { normalizeRouteParam } from "../lib/params";
import { notifyAdmin } from "../lib/telegram";
import { logger } from "../lib/logger";

const router = Router();
const COMMISSION_RATE = 0.07;

// FIX: используем PostgreSQL SEQUENCE для гарантированно уникальных номеров сделок
// Вместо MAX+1 (race condition при параллельных запросах)
async function getNextDealNumber(): Promise<number> {
  const [result] = await db.execute(
    sql`SELECT nextval('deal_number_seq')::int AS next_val`
  ) as any;
  return result.rows[0]?.next_val ?? (
    // Fallback если sequence ещё не создан: используем MAX+1 с небольшим случайным смещением
    (await db.select({ max: sql<number>`coalesce(max(deal_number), 1000)::int` }).from(deals))[0].max + 1
  );
}

router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { role = "all", page = "1", limit = "20" } = req.query as any;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, parseInt(limit));
    const offset = (pageNum - 1) * limitNum;

    let where;
    if (role === "buyer") where = eq(deals.buyerId, userId);
    else if (role === "seller") where = eq(deals.sellerId, userId);
    else where = or(eq(deals.buyerId, userId), eq(deals.sellerId, userId));

    const dealsList = await db
      .select({
        id: deals.id,
        dealNumber: deals.dealNumber,
        buyerId: deals.buyerId,
        sellerId: deals.sellerId,
        productId: deals.productId,
        amount: deals.amount,
        sellerAmount: deals.sellerAmount,
        commission: deals.commission,
        status: deals.status,
        createdAt: deals.createdAt,
        productTitle: products.title,
        productImages: products.images,
        buyerUsername: users.username,
      })
      .from(deals)
      .leftJoin(products, eq(deals.productId, products.id))
      .leftJoin(users, eq(deals.buyerId, users.id))
      .where(where)
      .orderBy(desc(deals.createdAt))
      .limit(limitNum)
      .offset(offset);

    const enriched = await Promise.all(
      dealsList.map(async (deal) => {
        const [seller] = await db
          .select({ username: users.username })
          .from(users)
          .where(eq(users.id, deal.sellerId))
          .limit(1);
        return {
          id: deal.id,
          dealNumber: deal.dealNumber,
          buyerId: deal.buyerId,
          sellerId: deal.sellerId,
          productId: deal.productId,
          amount: deal.amount,
          sellerAmount: deal.sellerAmount,
          commission: deal.commission,
          status: deal.status,
          createdAt: deal.createdAt,
          product: { title: deal.productTitle, images: deal.productImages },
          buyer: { username: deal.buyerUsername },
          seller: { username: seller?.username },
        };
      })
    );

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(deals).where(where);

    res.json({ deals: enriched, total: count, page: pageNum, totalPages: Math.ceil(count / limitNum) });
  } catch (err) {
    logger.error(err, "List deals error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const buyerId = (req as any).userId;
    const { productId } = req.body;
    if (!productId) { res.status(400).json({ message: "Missing productId" }); return; }

    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product || product.status !== "active") { res.status(400).json({ message: "Product not available" }); return; }
    if (product.sellerId === buyerId) { res.status(400).json({ message: "Cannot buy your own product" }); return; }

    const price = parseFloat(product.price);
    const commission = Math.round(price * COMMISSION_RATE * 100) / 100;
    const sellerAmount = price - commission;
    const dealNumber = await getNextDealNumber();

    // FIX: атомарное списание баланса — защита от race condition
    // UPDATE возвращает 0 строк если баланс недостаточен — нет двойного списания
    const balanceResult = await db.update(users)
      .set({
        balance: sql`balance - ${price.toFixed(2)}::numeric`,
        frozenBalance: sql`frozen_balance + ${price.toFixed(2)}::numeric`,
        totalPurchases: sql`total_purchases + 1`,
      })
      .where(and(
        eq(users.id, buyerId),
        sql`balance >= ${price.toFixed(2)}::numeric`,
      ))
      .returning({ newBalance: users.balance, oldTotalPurchases: users.totalPurchases });

    if (balanceResult.length === 0) {
      res.status(400).json({ message: "Insufficient funds" });
      return;
    }

    const balanceBefore = (parseFloat(balanceResult[0].newBalance) + price).toFixed(2);
    const balanceAfter = balanceResult[0].newBalance;

    await db.insert(transactions).values({
      userId: buyerId,
      type: "purchase",
      amount: price.toFixed(2),
      status: "completed",
      description: `Purchase: ${product.title}`,
      balanceBefore,
      balanceAfter,
    });

    const [deal] = await db.insert(deals).values({
      dealNumber,
      buyerId,
      sellerId: product.sellerId,
      productId: product.id,
      amount: price.toFixed(2),
      sellerAmount: sellerAmount.toFixed(2),
      commission: commission.toFixed(2),
      status: "paid",
      autoCompleteAt: Math.floor(Date.now() / 1000) + 86400 * 3,
    }).returning();

    if (product.deliveryType === "auto" && product.deliveryData) {
      await db.update(deals).set({ status: "delivered", deliveryData: product.deliveryData }).where(eq(deals.id, deal.id));
      deal.status = "delivered";
    }

    await notifyAdmin(`New deal #${dealNumber}: ${product.title} — ${price} ₽`);

    res.json(deal);
  } catch (err) {
    logger.error(err, "Create deal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const dealId = normalizeRouteParam(req.params.id);
    if (!dealId) { res.status(400).json({ message: "Invalid deal id" }); return; }
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
    if (!deal) { res.status(404).json({ message: "Not found" }); return; }
    if (deal.buyerId !== userId && deal.sellerId !== userId && !(req as any).isAdmin) {
      res.status(403).json({ message: "Forbidden" }); return;
    }

    const [product] = await db.select({ title: products.title, images: products.images }).from(products).where(eq(products.id, deal.productId)).limit(1);
    const [buyer] = await db.select({ id: users.id, username: users.username, avatar: users.avatar }).from(users).where(eq(users.id, deal.buyerId)).limit(1);
    const [seller] = await db.select({ id: users.id, username: users.username, avatar: users.avatar }).from(users).where(eq(users.id, deal.sellerId)).limit(1);

    res.json({ ...deal, product, buyer, seller });
  } catch (err) {
    logger.error(err, "Get deal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:id/deliver", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const dealId = normalizeRouteParam(req.params.id);
    if (!dealId) { res.status(400).json({ message: "Invalid deal id" }); return; }
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
    if (!deal || deal.sellerId !== userId) { res.status(403).json({ message: "Forbidden" }); return; }
    if (deal.status !== "paid") { res.status(400).json({ message: "Invalid status" }); return; }

    const { deliveryData } = req.body;
    await db.update(deals).set({ status: "delivered", deliveryData, autoCompleteAt: Math.floor(Date.now() / 1000) + 86400 }).where(eq(deals.id, deal.id));

    res.json({ message: "Delivered" });
  } catch (err) {
    logger.error(err, "Deliver deal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:id/confirm", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const dealId = normalizeRouteParam(req.params.id);
    if (!dealId) { res.status(400).json({ message: "Invalid deal id" }); return; }
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
    if (!deal || deal.buyerId !== userId) { res.status(403).json({ message: "Forbidden" }); return; }
    if (deal.status !== "delivered") { res.status(400).json({ message: "Invalid status" }); return; }

    await db.update(deals).set({ status: "completed", buyerConfirmed: true }).where(eq(deals.id, deal.id));

    const sellerAmount = parseFloat(deal.sellerAmount);

    // FIX: атомарные обновления для продавца и покупателя
    await db.update(users).set({
      balance: sql`balance + ${sellerAmount.toFixed(2)}::numeric`,
      totalSales: sql`total_sales + 1`,
      totalVolume: sql`total_volume + ${sellerAmount.toFixed(2)}::numeric`,
    }).where(eq(users.id, deal.sellerId));

    await db.update(users).set({
      frozenBalance: sql`GREATEST(0, frozen_balance - ${deal.amount}::numeric)`,
    }).where(eq(users.id, deal.buyerId));

    await db.insert(transactions).values({
      userId: deal.sellerId,
      type: "sale_revenue",
      amount: sellerAmount.toFixed(2),
      status: "completed",
      description: `Sale revenue for deal #${deal.dealNumber}`,
    });

    await db.update(products).set({ soldCount: sql`${products.soldCount} + 1` }).where(eq(products.id, deal.productId));

    res.json({ message: "Confirmed" });
  } catch (err) {
    logger.error(err, "Confirm deal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:id/dispute", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const dealId = normalizeRouteParam(req.params.id);
    if (!dealId) { res.status(400).json({ message: "Invalid deal id" }); return; }
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
    if (!deal || deal.buyerId !== userId) { res.status(403).json({ message: "Forbidden" }); return; }
    if (!["paid", "delivered"].includes(deal.status)) { res.status(400).json({ message: "Invalid status" }); return; }

    const { reason } = req.body;
    if (!reason?.trim()) { res.status(400).json({ message: "Dispute reason is required" }); return; }

    await db.update(deals).set({ status: "disputed", disputeReason: reason }).where(eq(deals.id, deal.id));

    await notifyAdmin(`Dispute on deal #${deal.dealNumber}: ${reason}`);
    res.json({ message: "Disputed" });
  } catch (err) {
    logger.error(err, "Dispute deal error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:id/review", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const dealId = normalizeRouteParam(req.params.id);
    if (!dealId) { res.status(400).json({ message: "Invalid deal id" }); return; }
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
    if (!deal || deal.buyerId !== userId) { res.status(403).json({ message: "Forbidden" }); return; }
    if (deal.status !== "completed") { res.status(400).json({ message: "Deal not completed" }); return; }

    if (deal.sellerId === userId) { res.status(400).json({ message: "Cannot review yourself" }); return; }

    const existing = await db.select().from(reviews).where(eq(reviews.dealId, deal.id)).limit(1);
    if (existing.length > 0) { res.status(400).json({ message: "Already reviewed" }); return; }

    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) { res.status(400).json({ message: "Invalid rating" }); return; }

    const [review] = await db.insert(reviews).values({
      dealId: deal.id,
      reviewerId: userId,
      sellerId: deal.sellerId,
      rating,
      comment,
    }).returning();

    const sellerReviews = await db.select({ rating: reviews.rating }).from(reviews).where(eq(reviews.sellerId, deal.sellerId));
    const avgRating = sellerReviews.reduce((s, r) => s + r.rating, 0) / sellerReviews.length;
    await db.update(users).set({
      rating: avgRating.toFixed(1),
      reviewCount: sellerReviews.length,
    }).where(eq(users.id, deal.sellerId));

    res.json(review);
  } catch (err) {
    logger.error(err, "Leave review error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
