import { pgTable, text, numeric, integer, boolean, bigint, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  avatar: text("avatar"),
  bio: text("bio"),
  telegramId: text("telegram_id").unique(),
  telegramUsername: text("telegram_username"),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  frozenBalance: numeric("frozen_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  totalDeposited: numeric("total_deposited", { precision: 12, scale: 2 }).notNull().default("0"),
  totalWithdrawn: numeric("total_withdrawn", { precision: 12, scale: 2 }).notNull().default("0"),
  totalSales: integer("total_sales").notNull().default(0),
  totalPurchases: integer("total_purchases").notNull().default(0),
  totalVolume: numeric("total_volume", { precision: 12, scale: 2 }).notNull().default("0"),
  rating: numeric("rating", { precision: 3, scale: 1 }).notNull().default("5.0"),
  reviewCount: integer("review_count").notNull().default(0),
  isAdmin: boolean("is_admin").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),
  banReason: text("ban_reason"),
  banAt: bigint("ban_at", { mode: "number" }),
  banUntil: bigint("ban_until", { mode: "number" }),
  sellerLevel: text("seller_level").notNull().default("newcomer"),
  refCode: text("ref_code").unique(),
  refBy: text("ref_by"),
  refCount: integer("ref_count").notNull().default(0),
  refRewards: numeric("ref_rewards", { precision: 12, scale: 2 }).notNull().default("0"),
  // 2FA via Telegram
  twoFAEnabled: boolean("two_fa_enabled").notNull().default(false),
  twoFACode: text("two_fa_code"),
  twoFAExpires: bigint("two_fa_expires", { mode: "number" }),
  notificationSettings: jsonb("notification_settings").$type<{ email: boolean; telegram: boolean; push: boolean }>().default({ email: true, telegram: true, push: false }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
  lastActive: bigint("last_active", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  index("users_telegram_id_idx").on(table.telegramId),
  index("users_username_idx").on(table.username),
]);

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, lastActive: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
