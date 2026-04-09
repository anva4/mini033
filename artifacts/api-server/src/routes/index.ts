import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import categoriesRouter from "./categories";
import productsRouter from "./products";
import dealsRouter from "./deals";
import walletRouter from "./wallet";
import messagesRouter from "./messages";
import adminRouter from "./admin";
import botRouter from "./bot";
import featuresRouter from "./features";
import radioRouter from "./radio";
import { authMiddleware } from "../lib/auth";
import { db } from "@workspace/db";
import { products, users, favorites } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/auth/config", (_req, res) => {
  res.json({ botUsername: process.env.TELEGRAM_BOT_USERNAME || null });
});

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/categories", categoriesRouter);
router.use("/products", productsRouter);
router.use("/deals", dealsRouter);
router.use("/wallet", walletRouter);
router.use("/messages", messagesRouter);
router.use("/admin", adminRouter);
router.use("/bot", botRouter);
router.use("/features", featuresRouter);
router.use("/radio", radioRouter);

// FIX БАГ #15: добавлен seller в ответ favorites
router.get("/favorites", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const favs = await db
      .select({
        id: products.id,
        title: products.title,
        price: products.price,
        images: products.images,
        views: products.views,
        soldCount: products.soldCount,
        createdAt: products.createdAt,
        sellerUsername: users.username,
        sellerRating: users.rating,
        sellerAvatar: users.avatar,
      })
      .from(favorites)
      .innerJoin(products, eq(favorites.productId, products.id))
      .leftJoin(users, eq(products.sellerId, users.id))
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));

    const result = favs.map((f) => ({
      id: f.id,
      title: f.title,
      price: f.price,
      images: f.images,
      views: f.views,
      soldCount: f.soldCount,
      createdAt: f.createdAt,
      seller: { username: f.sellerUsername, rating: f.sellerRating, avatar: f.sellerAvatar },
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/profile", authMiddleware, async (req, res) => {
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
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
