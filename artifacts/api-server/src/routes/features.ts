import { Router } from "express";
import { db } from "@workspace/db";
import { users, ratings, referrals, notifications, lottery, lotteryEntries, searchHistory, priceTracking } from "@workspace/db/schema";
import { eq, and, desc, sql, ilike } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { logger } from "../lib/logger";
import { normalizeRouteParam } from "../lib/params";

const router = Router();

// ========== 2FA Telegram ==========
router.post("/2fa/enable", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    await db.update(users).set({ twoFAEnabled: true }).where(eq(users.id, userId));
    res.json({ message: "2FA enabled. Send /2fa to bot for code" });
  } catch (err) {
    logger.error(err, "Enable 2FA error");
    res.status(500).json({ message: "Error" });
  }
});

router.post("/2fa/verify", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { code } = req.body;
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    const now = Math.floor(Date.now() / 1000);
    if (!user?.twoFACode || user.twoFACode !== code || !user.twoFAExpires || user.twoFAExpires < now) {
      res.status(400).json({ message: "Invalid or expired code" });
      return;
    }
    
    await db.update(users).set({ twoFACode: null, twoFAExpires: null }).where(eq(users.id, userId));
    res.json({ message: "2FA verified" });
  } catch (err) {
    logger.error(err, "Verify 2FA error");
    res.status(500).json({ message: "Error" });
  }
});

// ========== Ratings v2 ==========
router.post("/ratings", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { sellerId, productId, rating, comment, photos, tags } = req.body;
    
    if (!sellerId || !rating || rating < 1 || rating > 5) {
      res.status(400).json({ message: "Invalid data" });
      return;
    }
    
    const [newRating] = await db.insert(ratings).values({
      reviewerId: userId,
      sellerId,
      productId,
      rating,
      comment,
      photos: photos || [],
      tags: tags || [],
    }).returning();
    
    // Update seller rating
    const [stats] = await db.select({
      avgRating: sql<number>`avg(rating)::numeric`,
      count: sql<number>`count(*)::int`,
    }).from(ratings).where(eq(ratings.sellerId, sellerId));
    
    await db.update(users).set({
      rating: stats.avgRating?.toString(),
      reviewCount: stats.count,
    }).where(eq(users.id, sellerId));
    
    res.json(newRating);
  } catch (err) {
    logger.error(err, "Create rating error");
    res.status(500).json({ message: "Error" });
  }
});

router.get("/ratings/:sellerId", async (req, res) => {
  try {
    const ratingsList = await db.select({
      id: ratings.id,
      rating: ratings.rating,
      comment: ratings.comment,
      photos: ratings.photos,
      tags: ratings.tags,
      helpful: ratings.helpful,
      createdAt: ratings.createdAt,
      reviewer: {
        username: users.username,
        avatar: users.avatar,
      },
    })
      .from(ratings)
      .innerJoin(users, eq(ratings.reviewerId, users.id))
      .where(eq(ratings.sellerId, req.params.sellerId))
      .orderBy(desc(ratings.createdAt))
      .limit(50);
    
    res.json(ratingsList);
  } catch (err) {
    logger.error(err, "Get ratings error");
    res.status(500).json({ message: "Error" });
  }
});

// ========== Referral System ==========
router.get("/referral/info", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    res.json({
      refCode: user?.refCode,
      refCount: user?.refCount || 0,
      refRewards: user?.refRewards || "0",
      refLink: `${process.env.APP_URL}?ref=${user?.refCode}`,
    });
  } catch (err) {
    logger.error(err, "Get referral info error");
    res.status(500).json({ message: "Error" });
  }
});

router.get("/referral/list", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const refs = await db.select({
      id: referrals.id,
      username: users.username,
      bonusPercent: referrals.bonusPercent,
      totalEarnings: referrals.totalEarnings,
      dealCount: referrals.dealCount,
      createdAt: referrals.createdAt,
    })
      .from(referrals)
      .innerJoin(users, eq(referrals.referredId, users.id))
      .where(eq(referrals.referrerId, userId))
      .orderBy(desc(referrals.totalEarnings))
      .limit(100);
    
    res.json(refs);
  } catch (err) {
    logger.error(err, "Get referrals error");
    res.status(500).json({ message: "Error" });
  }
});

// ========== Search History & Saved Searches ==========
router.post("/search/save", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { query, filters, savedName } = req.body;
    
    const [search] = await db.insert(searchHistory).values({
      userId,
      query,
      filters: filters || {},
      isSaved: true,
      savedName: savedName || query,
    }).returning();
    
    res.json(search);
  } catch (err) {
    logger.error(err, "Save search error");
    res.status(500).json({ message: "Error" });
  }
});

router.get("/search/saved", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const searches = await db.select().from(searchHistory)
      .where(and(eq(searchHistory.userId, userId), eq(searchHistory.isSaved, true)))
      .orderBy(desc(searchHistory.createdAt))
      .limit(50);
    
    res.json(searches);
  } catch (err) {
    logger.error(err, "Get saved searches error");
    res.status(500).json({ message: "Error" });
  }
});

// ========== Lottery ==========
router.post("/lottery/enter", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { reason } = req.body; // "review", "referral", "trade"
    
    // Get current week lottery
    const weekNumber = Math.floor(Date.now() / 1000 / 604800);
    let [currentLottery] = await db.select().from(lottery).where(eq(lottery.weekNumber, weekNumber)).limit(1);
    
    if (!currentLottery) {
      const nextDraw = Math.floor(Date.now() / 1000) + 604800;
      [currentLottery] = await db.insert(lottery).values({
        weekNumber,
        drawDate: nextDraw,
        prize: "5000",
      }).returning();
    }
    
    // Add entry
    const [entry] = await db.insert(lotteryEntries).values({
      lotteryId: currentLottery.id,
      userId,
      entryReason: reason || "trade",
    }).returning();
    
    res.json({ message: "Entry added", entryId: entry.id });
  } catch (err) {
    logger.error(err, "Lottery enter error");
    res.status(500).json({ message: "Error" });
  }
});

router.get("/lottery/current", async (req, res) => {
  try {
    const weekNumber = Math.floor(Date.now() / 1000 / 604800);
    const [currentLottery] = await db.select().from(lottery).where(eq(lottery.weekNumber, weekNumber)).limit(1);
    
    if (!currentLottery) {
      res.json({ message: "No active lottery" });
      return;
    }
    
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(lotteryEntries)
      .where(eq(lotteryEntries.lotteryId, currentLottery.id));
    
    res.json({
      ...currentLottery,
      participantCount: count,
    });
  } catch (err) {
    logger.error(err, "Get lottery error");
    res.status(500).json({ message: "Error" });
  }
});

// ========== Price Tracking ==========
router.post("/track/price", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { productId, targetPrice } = req.body;
    
    const [track] = await db.insert(priceTracking).values({
      userId,
      productId,
      targetPrice: targetPrice.toString(),
      currentPrice: "0",
    }).returning();
    
    res.json(track);
  } catch (err) {
    logger.error(err, "Track price error");
    res.status(500).json({ message: "Error" });
  }
});

// ========== Notifications ==========
router.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const notifs = await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    
    res.json(notifs);
  } catch (err) {
    logger.error(err, "Get notifications error");
    res.status(500).json({ message: "Error" });
  }
});

router.post("/notifications/:id/read", authMiddleware, async (req, res) => {
  try {
    const notifId = normalizeRouteParam(req.params.id);
    if (!notifId) {
      res.status(400).json({ message: "Invalid notification id" });
      return;
    }
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, notifId));
    res.json({ message: "Marked as read" });
  } catch (err) {
    logger.error(err, "Mark notification read error");
    res.status(500).json({ message: "Error" });
  }
});

export default router;
