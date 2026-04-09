import { pgTable, text, numeric, integer, boolean, bigint, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users, products } from "./index";

// Extended ratings with photo
export const ratings = pgTable("ratings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  dealId: text("deal_id"),
  reviewerId: text("reviewer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sellerId: text("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  photos: jsonb("photos").$type<string[]>().default([]),
  tags: jsonb("tags").$type<string[]>().default([]), // "быстро", "надёжно", "оригинал"
  helpful: integer("helpful").notNull().default(0),
  notHelpful: integer("not_helpful").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  index("ratings_seller_id_idx").on(table.sellerId),
  index("ratings_reviewer_id_idx").on(table.reviewerId),
]);

// Deal guarantees (escrow)
export const guarantees = pgTable("guarantees", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  dealId: text("deal_id").notNull().unique(),
  buyerId: text("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sellerId: text("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("active"), // active, buyer_confirmed, released, disputed
  insurance: numeric("insurance", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
}, (table) => [
  index("guarantees_deal_id_idx").on(table.dealId),
  index("guarantees_buyer_id_idx").on(table.buyerId),
]);

// Referer system
export const referrals = pgTable("referrals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  referrerId: text("referrer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  referredId: text("referred_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bonusPercent: integer("bonus_percent").notNull().default(5), // 5%, 10% based on level
  totalEarnings: numeric("total_earnings", { precision: 12, scale: 2 }).notNull().default("0"),
  dealCount: integer("deal_count").notNull().default(0),
  status: text("status").notNull().default("active"), // active, inactive
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  index("referrals_referrer_id_idx").on(table.referrerId),
  index("referrals_referred_id_idx").on(table.referredId),
]);

// Lottery system
export const lottery = pgTable("lottery", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  weekNumber: integer("week_number").notNull(),
  drawDate: bigint("draw_date", { mode: "number" }).notNull(),
  prize: numeric("prize", { precision: 12, scale: 2 }).notNull(),
  winnerId: text("winner_id").references(() => users.id, { onDelete: "set null" }),
  participantCount: integer("participant_count").notNull().default(0),
  status: text("status").notNull().default("active"), // active, drawn, distributed
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  index("lottery_week_number_idx").on(table.weekNumber),
]);

// Lottery entries (many-to-many for users who participated)
export const lotteryEntries = pgTable("lottery_entries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  lotteryId: text("lottery_id").notNull().references(() => lottery.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entryReason: text("entry_reason"), // "review", "referral", "trade"
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  index("lottery_entries_lottery_id_idx").on(table.lotteryId),
  index("lottery_entries_user_id_idx").on(table.userId),
]);

// Search history & saved searches
export const searchHistory = pgTable("search_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  filters: jsonb("filters").$type<Record<string, any>>().default({}), // category, price range, etc
  isSaved: boolean("is_saved").notNull().default(false),
  savedName: text("saved_name"),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  index("search_history_user_id_idx").on(table.userId),
  index("search_history_is_saved_idx").on(table.isSaved),
]);

// Rich chat messages with photos
export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  senderId: text("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipientId: text("recipient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content"),
  photos: jsonb("photos").$type<string[]>().default([]),
  quickReply: text("quick_reply"), // template reply
  isPinned: boolean("is_pinned").notNull().default(false),
  isRead: boolean("is_read").notNull().default(false),
  readAt: bigint("read_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  index("chat_messages_sender_id_idx").on(table.senderId),
  index("chat_messages_recipient_id_idx").on(table.recipientId),
  index("chat_messages_is_read_idx").on(table.isRead),
]);

// Seller dashboard notifications
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "deal", "message", "review", "referral", "withdrawal"
  title: text("title").notNull(),
  message: text("message").notNull(),
  actionUrl: text("action_url"),
  isRead: boolean("is_read").notNull().default(false),
  channels: jsonb("channels").$type<string[]>().default(["push"]), // "email", "telegram", "push"
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_is_read_idx").on(table.isRead),
]);

// Price tracker for alerts
export const priceTracking = pgTable("price_tracking", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  targetPrice: numeric("target_price", { precision: 12, scale: 2 }).notNull(),
  currentPrice: numeric("current_price", { precision: 12, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  alertSent: boolean("alert_sent").notNull().default(false),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  index("price_tracking_user_id_idx").on(table.userId),
  index("price_tracking_product_id_idx").on(table.productId),
]);

export const insertRatingSchema = createInsertSchema(ratings).omit({ id: true, createdAt: true });
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratings.$inferSelect;

export const insertReferralSchema = createInsertSchema(referrals).omit({ id: true, createdAt: true });
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
