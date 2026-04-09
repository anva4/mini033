import { Router } from "express";
import { db } from "@workspace/db";
import { products, users, favorites } from "@workspace/db/schema";
import { eq, desc, asc, sql, and, ilike, or } from "drizzle-orm";
import { authMiddleware, optionalAuth } from "../lib/auth";
import { logger } from "../lib/logger";
import { normalizeRouteParam } from "../lib/params";

const router = Router();

router.get("/", optionalAuth, async (req, res) => {
  try {
    const { search, category, subcategory, game, sort = "newest", page = "1", limit = "20" } = req.query as any;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [eq(products.status, "active")];
    if (category) conditions.push(eq(products.category, category));
    if (subcategory) conditions.push(eq(products.subcategory, subcategory));
    if (game) conditions.push(eq(products.game, game));
    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(or(
        ilike(products.title, searchTerm),
        ilike(products.description, searchTerm),
        sql`${products.tags}::text ILIKE ${searchTerm}`
      )!);
    }

    const where = and(...conditions);

    let orderBy;
    switch (sort) {
      case "cheapest": orderBy = asc(products.price); break;
      case "expensive": orderBy = desc(products.price); break;
      case "popular": orderBy = desc(products.views); break;
      default: orderBy = desc(products.createdAt);
    }

    const prods = await db.select({
      id: products.id,
      sellerId: products.sellerId,
      title: products.title,
      description: products.description,
      price: products.price,
      category: products.category,
      subcategory: products.subcategory,
      images: products.images,
      deliveryType: products.deliveryType,
      game: products.game,
      server: products.server,
      status: products.status,
      views: products.views,
      soldCount: products.soldCount,
      tags: products.tags,
      isPromoted: products.isPromoted,
      createdAt: products.createdAt,
      seller: {
        id: users.id,
        username: users.username,
        avatar: users.avatar,
        rating: users.rating,
        totalSales: users.totalSales,
        isVerified: users.isVerified,
      },
    }).from(products)
      .leftJoin(users, eq(products.sellerId, users.id))
      .where(where)
      .orderBy(desc(products.isPromoted), orderBy)
      .limit(limitNum)
      .offset(offset);

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(products).where(where);

    res.json({
      products: prods,
      total: count,
      page: pageNum,
      totalPages: Math.ceil(count / limitNum),
    });
  } catch (err) {
    logger.error(err, "List products error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/stats", async (_req, res) => {
  try {
    const { sql: sqlFn } = await import("drizzle-orm");
    const [{ totalUsers }] = await db.select({ totalUsers: sql<number>`count(*)::int` }).from(users);
    const [{ totalProducts }] = await db.select({ totalProducts: sql<number>`count(*)::int` }).from(products).where(eq(products.status, "active"));
    const { deals } = await import("@workspace/db/schema");
    const [{ totalDeals }] = await db.select({ totalDeals: sql<number>`count(*)::int` }).from(deals).where(eq(deals.status, "completed"));
    res.json({ totalUsers, totalProducts, totalDeals });
  } catch (err) {
    logger.error(err, "Stats error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/featured", async (_req, res) => {
  try {
    const prods = await db.select({
      id: products.id,
      sellerId: products.sellerId,
      title: products.title,
      price: products.price,
      images: products.images,
      views: products.views,
      soldCount: products.soldCount,
      isPromoted: products.isPromoted,
      createdAt: products.createdAt,
      seller: {
        id: users.id,
        username: users.username,
        avatar: users.avatar,
        rating: users.rating,
      },
    }).from(products)
      .leftJoin(users, eq(products.sellerId, users.id))
      .where(and(eq(products.status, "active"), eq(products.isPromoted, true)))
      .orderBy(desc(products.createdAt))
      .limit(10);
    res.json(prods);
  } catch (err) {
    logger.error(err, "Get featured error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/user/favorites", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const favs = await db.select({
      id: products.id,
      title: products.title,
      price: products.price,
      images: products.images,
      views: products.views,
      soldCount: products.soldCount,
      createdAt: products.createdAt,
    }).from(favorites)
      .innerJoin(products, eq(favorites.productId, products.id))
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));
    res.json(favs);
  } catch (err) {
    logger.error(err, "Get favorites error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const productId = normalizeRouteParam(req.params.id);
    if (!productId) { res.status(400).json({ message: "Invalid product id" }); return; }

    const [product] = await db.select({
      id: products.id,
      sellerId: products.sellerId,
      title: products.title,
      description: products.description,
      price: products.price,
      category: products.category,
      subcategory: products.subcategory,
      images: products.images,
      deliveryType: products.deliveryType,
      game: products.game,
      server: products.server,
      status: products.status,
      views: products.views,
      soldCount: products.soldCount,
      tags: products.tags,
      isPromoted: products.isPromoted,
      createdAt: products.createdAt,
      seller: {
        id: users.id,
        username: users.username,
        avatar: users.avatar,
        rating: users.rating,
        totalSales: users.totalSales,
        isVerified: users.isVerified,
      },
    }).from(products)
      .leftJoin(users, eq(products.sellerId, users.id))
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) { res.status(404).json({ message: "Not found" }); return; }

    await db.update(products).set({ views: (product.views || 0) + 1 }).where(eq(products.id, product.id));

    let isFavorited = false;
    const userId = (req as any).userId;
    if (userId) {
      const fav = await db.select().from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.productId, product.id))).limit(1);
      isFavorited = fav.length > 0;
    }

    res.json({ ...product, isFavorited });
  } catch (err) {
    logger.error(err, "Get product error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { title, description, price, category, subcategory, images, deliveryType, deliveryData, game, server, tags } = req.body;

    if (!title || !description || !price || !category) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }

    const [product] = await db.insert(products).values({
      sellerId: userId,
      title,
      description,
      price: price.toString(),
      category,
      subcategory,
      images: images || [],
      deliveryType: deliveryType || "manual",
      deliveryData,
      game,
      server,
      tags: tags || [],
    }).returning();

    res.json(product);
  } catch (err) {
    logger.error(err, "Create product error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const productId = normalizeRouteParam(req.params.id);
    if (!productId) { res.status(400).json({ message: "Invalid product id" }); return; }
    const [existing] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!existing || existing.sellerId !== userId) { res.status(403).json({ message: "Forbidden" }); return; }

    const { title, description, price, category, images, deliveryType, deliveryData, game, server, tags, status } = req.body;
    const [product] = await db.update(products).set({
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(price ? { price: price.toString() } : {}),
      ...(category ? { category } : {}),
      ...(images ? { images } : {}),
      ...(deliveryType ? { deliveryType } : {}),
      ...(deliveryData !== undefined ? { deliveryData } : {}),
      ...(game !== undefined ? { game } : {}),
      ...(server !== undefined ? { server } : {}),
      ...(tags ? { tags } : {}),
      ...(status && ["active", "hidden"].includes(status) ? { status } : {}),
      updatedAt: Math.floor(Date.now() / 1000),
    }).where(eq(products.id, productId)).returning();

    res.json(product);
  } catch (err) {
    logger.error(err, "Update product error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const productId = normalizeRouteParam(req.params.id);
    if (!productId) { res.status(400).json({ message: "Invalid product id" }); return; }
    const [existing] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!existing || (existing.sellerId !== userId && !(req as any).isAdmin)) { res.status(403).json({ message: "Forbidden" }); return; }

    await db.delete(products).where(eq(products.id, productId));
    res.json({ message: "Deleted" });
  } catch (err) {
    logger.error(err, "Delete product error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:id/favorite", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const productId = normalizeRouteParam(req.params.id);
    if (!productId) { res.status(400).json({ message: "Invalid product id" }); return; }
    const existing = await db.select().from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.productId, productId))).limit(1);

    if (existing.length > 0) {
      await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.productId, productId)));
      res.json({ favorited: false });
    } else {
      await db.insert(favorites).values({ userId, productId });
      res.json({ favorited: true });
    }
  } catch (err) {
    logger.error(err, "Toggle favorite error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
