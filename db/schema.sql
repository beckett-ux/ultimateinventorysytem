-- Initial Postgres schema for Shopify installs, per-shop settings, intake history, and mappings.
-- Run this once against your database using any SQL client connected to Postgres (execute this file as SQL).

CREATE TABLE IF NOT EXISTS shops (
  id BIGSERIAL PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  access_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shops_shop_domain_unique UNIQUE (shop_domain)
);

CREATE TABLE IF NOT EXISTS shop_settings (
  id BIGSERIAL PRIMARY KEY,
  shop_id BIGINT NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
  default_location_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_settings_shop_id_unique UNIQUE (shop_id)
);

-- Ensure existing databases have the columns/keys needed for UPSERTs.
ALTER TABLE shop_settings
  ADD COLUMN IF NOT EXISTS default_location_id BIGINT;

-- UPSERTs rely on a unique constraint or unique index on (shop_id).
CREATE UNIQUE INDEX IF NOT EXISTS shop_settings_shop_id_unique ON shop_settings (shop_id);

CREATE TABLE IF NOT EXISTS intakes (
  id BIGSERIAL PRIMARY KEY,
  shop_id BIGINT NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS product_mappings (
  id BIGSERIAL PRIMARY KEY,
  intake_id BIGINT NOT NULL REFERENCES intakes (id) ON DELETE CASCADE,
  shopify_product_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_mappings_intake_product_unique UNIQUE (intake_id, shopify_product_id)
);

-- Indexes: shop lookups and created_at sorting.
CREATE INDEX IF NOT EXISTS idx_shops_shop_domain ON shops (shop_domain);
CREATE INDEX IF NOT EXISTS idx_shop_settings_shop_id ON shop_settings (shop_id);
CREATE INDEX IF NOT EXISTS idx_intakes_shop_created_at_desc ON intakes (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_mappings_intake_id ON product_mappings (intake_id);

-- Inventory intake table used by the local UI.
CREATE TABLE IF NOT EXISTS inventory_items (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  sku TEXT,
  brand TEXT,
  category TEXT,
  condition TEXT,
  price_cents INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

