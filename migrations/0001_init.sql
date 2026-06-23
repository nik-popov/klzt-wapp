-- 0001_init.sql
-- Initial schema for KLZT.
--
-- V2 attribute roadmap (brand, color, pattern, material, item_type, fit,
-- occasion, size, tag, season, notes) lives inside the `metadata` JSON
-- blob until any one of them needs to be queried or indexed. Promote to
-- a first-class column then.

CREATE TABLE IF NOT EXISTS items (
  id                   TEXT PRIMARY KEY,
  created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
  sort_order           INTEGER NOT NULL,
  raw_image_url        TEXT NOT NULL,
  processed_image_url  TEXT,
  status               TEXT NOT NULL DEFAULT 'raw'
                         CHECK (status IN ('raw', 'processing', 'ready')),
  metadata             TEXT
);

CREATE INDEX IF NOT EXISTS idx_items_sort_order ON items (sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_items_status     ON items (status);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items (created_at DESC);
