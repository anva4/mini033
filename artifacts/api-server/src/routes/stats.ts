import { Router } from "express";
import { db } from "@workspace/db";
import { users, products, deals } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const [{ totalUsers }] = await db.select({ totalUsers: sql<number>`count(*)::int` }).from(users);
    const [{ totalProducts }] = await db.select({ totalProducts: sql<number>`count(*)::int` }).from(products).where(eq(products.status, "active"));
    const [{ totalDeals }] = await db.select({ totalDeals: sql<number>`count(*)::int` }).from(deals).where(eq(deals.status, "completed"));

    res.json({ totalUsers, totalProducts, totalDeals });
  } catch (err) {
    logger.error(err, "Stats error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
