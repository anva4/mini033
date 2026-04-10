import app from "./app";
import { logger } from "./lib/logger";
import { seed } from "./seed";
import { pool } from "@workspace/db";
import { setupWebhook } from "./lib/bot";

const rawPort = process.env["PORT"] ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT,
        first_name TEXT,
        last_name TEXT,
        avatar TEXT,
        bio TEXT,
        telegram_id TEXT UNIQUE,
        telegram_username TEXT,
        balance NUMERIC(12,2) NOT NULL DEFAULT 0,
        frozen_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_deposited NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_withdrawn NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_sales INTEGER NOT NULL DEFAULT 0,
        total_purchases INTEGER NOT NULL DEFAULT 0,
        total_volume NUMERIC(12,2) NOT NULL DEFAULT 0,
        rating NUMERIC(3,1) NOT NULL DEFAULT 5.0,
        review_count INTEGER NOT NULL DEFAULT 0,
        is_admin BOOLEAN NOT NULL DEFAULT false,
        is_verified BOOLEAN NOT NULL DEFAULT false,
        is_banned BOOLEAN NOT NULL DEFAULT false,
        seller_level TEXT NOT NULL DEFAULT 'newcomer',
        ref_code TEXT UNIQUE,
        ref_by TEXT,
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
        last_active BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
      );
      CREATE INDEX IF NOT EXISTS users_telegram_id_idx ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS users_username_idx ON users(username);

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        icon TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        price NUMERIC(12,2) NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT,
        images JSONB NOT NULL DEFAULT '[]',
        delivery_type TEXT NOT NULL DEFAULT 'manual',
        delivery_data TEXT,
        game TEXT,
        server TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        views INTEGER NOT NULL DEFAULT 0,
        sold_count INTEGER NOT NULL DEFAULT 0,
        tags JSONB NOT NULL DEFAULT '[]',
        is_promoted BOOLEAN NOT NULL DEFAULT false,
        promoted_until BIGINT,
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
        updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
      );
      CREATE INDEX IF NOT EXISTS products_seller_id_idx ON products(seller_id);
      CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);
      CREATE INDEX IF NOT EXISTS products_subcategory_idx ON products(subcategory);
      CREATE INDEX IF NOT EXISTS products_game_idx ON products(game);
      CREATE INDEX IF NOT EXISTS products_status_idx ON products(status);
      CREATE INDEX IF NOT EXISTS products_created_at_idx ON products(created_at);

      CREATE TABLE IF NOT EXISTS favorites (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
      );
      CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON favorites(user_id);

      CREATE TABLE IF NOT EXISTS deals (
        id TEXT PRIMARY KEY,
        deal_number INTEGER NOT NULL UNIQUE,
        buyer_id TEXT NOT NULL REFERENCES users(id),
        seller_id TEXT NOT NULL REFERENCES users(id),
        product_id TEXT NOT NULL REFERENCES products(id),
        amount NUMERIC(12,2) NOT NULL,
        seller_amount NUMERIC(12,2) NOT NULL,
        commission NUMERIC(12,2) NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        delivery_data TEXT,
        buyer_confirmed BOOLEAN NOT NULL DEFAULT false,
        auto_complete_at BIGINT,
        dispute_reason TEXT,
        admin_comment TEXT,
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
      );
      CREATE INDEX IF NOT EXISTS deals_buyer_id_idx ON deals(buyer_id);
      CREATE INDEX IF NOT EXISTS deals_seller_id_idx ON deals(seller_id);
      CREATE INDEX IF NOT EXISTS deals_status_idx ON deals(status);

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        type TEXT NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'RUB',
        status TEXT NOT NULL DEFAULT 'pending',
        description TEXT,
        gateway_type TEXT,
        gateway_order_id TEXT,
        withdraw_method TEXT,
        withdraw_details TEXT,
        balance_before NUMERIC(12,2),
        balance_after NUMERIC(12,2),
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
      );
      CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS transactions_status_idx ON transactions(status);
      CREATE INDEX IF NOT EXISTS transactions_type_idx ON transactions(type);

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL REFERENCES users(id),
        receiver_id TEXT NOT NULL REFERENCES users(id),
        text TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
      );
      CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS messages_receiver_id_idx ON messages(receiver_id);
      CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);

      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        deal_id TEXT NOT NULL UNIQUE REFERENCES deals(id),
        reviewer_id TEXT NOT NULL REFERENCES users(id),
        seller_id TEXT NOT NULL REFERENCES users(id),
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
      );
      CREATE INDEX IF NOT EXISTS reviews_seller_id_idx ON reviews(seller_id);
      CREATE INDEX IF NOT EXISTS reviews_reviewer_id_idx ON reviews(reviewer_id);

      CREATE TABLE IF NOT EXISTS auth_codes (
        id TEXT PRIMARY KEY,
        telegram_username TEXT NOT NULL,
        telegram_id TEXT,
        code TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        used_at BIGINT,
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
      );
      CREATE INDEX IF NOT EXISTS auth_codes_telegram_username_idx ON auth_codes(telegram_username);
      CREATE INDEX IF NOT EXISTS auth_codes_code_idx ON auth_codes(code);
    `);

    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS ref_count INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS ref_rewards NUMERIC(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS two_fa_code TEXT,
        ADD COLUMN IF NOT EXISTS two_fa_expires BIGINT,
        ADD COLUMN IF NOT EXISTS notification_settings JSONB NOT NULL DEFAULT '{}';
    `);

    logger.info("Database migration completed");
  } finally {
    client.release();
  }
}

async function start() {
  await migrate();
  await seed().catch((err) => logger.error(err, "Seed failed"));
  await setupWebhook();

  app.listen(port, "0.0.0.0", (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start().catch((err) => {
  logger.error(err, "Failed to start server");
  process.exit(1);
});
