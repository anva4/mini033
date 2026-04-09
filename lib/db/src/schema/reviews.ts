import { pgTable, text, integer, bigint, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";
import { deals } from "./deals";

export const reviews = pgTable("reviews", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  dealId: text("deal_id").notNull().references(() => deals.id).unique(),
  reviewerId: text("reviewer_id").notNull().references(() => users.id),
  sellerId: text("seller_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  index("reviews_seller_id_idx").on(table.sellerId),
  index("reviews_reviewer_id_idx").on(table.reviewerId),
]);

export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;
