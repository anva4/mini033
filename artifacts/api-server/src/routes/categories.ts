import { Router } from "express";
import { db } from "@workspace/db";
import { categories, products } from "@workspace/db/schema";
import { eq, sql, asc } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const cats = await db.select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      icon: categories.icon,
      sortOrder: categories.sortOrder,
      isActive: categories.isActive,
      productCount: sql<number>`(select count(*) from products where products.category = ${categories.slug} and products.status = 'active')::int`,
    }).from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder));
    res.json(cats);
  } catch (err) {
    logger.error(err, "Get categories error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
