import { pgTable, text, numeric, bigint, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const transactions = pgTable("transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("RUB"),
  status: text("status").notNull().default("pending"),
  description: text("description"),
  gatewayType: text("gateway_type"),
  gatewayOrderId: text("gateway_order_id"),
  withdrawMethod: text("withdraw_method"),
  withdrawDetails: text("withdraw_details"),
  balanceBefore: numeric("balance_before", { precision: 12, scale: 2 }),
  balanceAfter: numeric("balance_after", { precision: 12, scale: 2 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  index("transactions_user_id_idx").on(table.userId),
  index("transactions_status_idx").on(table.status),
  index("transactions_type_idx").on(table.type),
]);

export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
