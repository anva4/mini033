import { pgTable, text, numeric, integer, boolean, bigint, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const products = pgTable("products", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sellerId: text("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  images: jsonb("images").$type<string[]>().notNull().default([]),
  deliveryType: text("delivery_type").notNull().default("manual"),
  deliveryData: text("delivery_data"),
  game: text("game"),
  server: text("server"),
  status: text("status").notNull().default("active"),
  views: integer("views").notNull().default(0),
  soldCount: integer("sold_count").notNull().default(0),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  isPromoted: boolean("is_promoted").notNull().default(false),
  promotedUntil: bigint("promoted_until", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  index("products_seller_id_idx").on(table.sellerId),
  index("products_category_idx").on(table.category),
  index("products_subcategory_idx").on(table.subcategory),
  index("products_game_idx").on(table.game),
  index("products_status_idx").on(table.status),
  index("products_created_at_idx").on(table.createdAt),
]);

export const favorites = pgTable("favorites", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  index("favorites_user_id_idx").on(table.userId),
]);

export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true, views: true, soldCount: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
