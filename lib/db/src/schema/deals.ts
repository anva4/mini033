import { pgTable, text, numeric, boolean, bigint, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";
import { products } from "./products";

export const deals = pgTable("deals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  dealNumber: integer("deal_number").notNull().unique(),
  buyerId: text("buyer_id").notNull().references(() => users.id),
  sellerId: text("seller_id").notNull().references(() => users.id),
  productId: text("product_id").notNull().references(() => products.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  sellerAmount: numeric("seller_amount", { precision: 12, scale: 2 }).notNull(),
  commission: numeric("commission", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  deliveryData: text("delivery_data"),
  buyerConfirmed: boolean("buyer_confirmed").notNull().default(false),
  autoCompleteAt: bigint("auto_complete_at", { mode: "number" }),
  disputeReason: text("dispute_reason"),
  adminComment: text("admin_comment"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  index("deals_buyer_id_idx").on(table.buyerId),
  index("deals_seller_id_idx").on(table.sellerId),
  index("deals_status_idx").on(table.status),
]);

export const insertDealSchema = createInsertSchema(deals).omit({ id: true, createdAt: true });
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;
