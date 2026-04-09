import { pgTable, text, bigint, index } from "drizzle-orm/pg-core";

export const authCodes = pgTable("auth_codes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  telegramUsername: text("telegram_username").notNull(),
  telegramId: text("telegram_id"),
  code: text("code").notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  usedAt: bigint("used_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => [
  index("auth_codes_telegram_username_idx").on(table.telegramUsername),
  index("auth_codes_code_idx").on(table.code),
]);
