import { Router } from "express";
import { db } from "@workspace/db";
import { users, products, reviews } from "@workspace/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, (req as any).userId)).limit(1);
    if (!user) { res.status(404).json({ message: "User not found" }); return; }
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    logger.error(err, "Get me error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/me", authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, avatar, bio } = req.body;
    const [user] = await db.update(users).set({
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(avatar !== undefined ? { avatar } : {}),
      ...(bio !== undefined ? { bio } : {}),
    }).where(eq(users.id, (req as any).userId)).returning();
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    logger.error(err, "Update profile error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.params.id)).limit(1);
    if (!user) { res.status(404).json({ message: "User not found" }); return; }
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    logger.error(err, "Get user error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id/products", async (req, res) => {
  try {
    const prods = await db.select().from(products)
      .where(and(eq(products.sellerId, req.params.id), eq(products.status, "active")))
      .orderBy(desc(products.createdAt))
      .limit(50);
    res.json({ products: prods, total: prods.length });
  } catch (err) {
    logger.error(err, "Get user products error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id/reviews", async (req, res) => {
  try {
    const revs = await db.select({
      id: reviews.id,
      dealId: reviews.dealId,
      reviewerId: reviews.reviewerId,
      sellerId: reviews.sellerId,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      reviewer: {
        id: users.id,
        username: users.username,
        avatar: users.avatar,
      },
    }).from(reviews)
      .leftJoin(users, eq(reviews.reviewerId, users.id))
      .where(eq(reviews.sellerId, req.params.id))
      .orderBy(desc(reviews.createdAt))
      .limit(50);
    res.json(revs);
  } catch (err) {
    logger.error(err, "Get user reviews error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
