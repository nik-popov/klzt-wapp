-- 0002_auth_and_users.sql
-- Adds Google-OAuth-backed accounts, sessions, and per-user closets.
--
-- Schema scope for Phase 2:
--   - users      : one row per Google account (sub is the source of truth).
--   - sessions   : opaque cookie ids -> user. Expires_at indexed for cleanup.
--   - closets    : per-user buckets. Single closet per user until Phase 5.
--   - items      : gains user_id + closet_id. Existing rows are backfilled
--                  to the bootstrap admin user (see below).
--
-- Bootstrap flow: the bootstrap admin row owns all pre-Phase-2 items.
-- On first login, if BOOTSTRAP_USER_EMAIL matches the incoming Google
-- email AND the bootstrap row still has the placeholder google_sub, the
-- callback rewrites that row to claim it — so seed data appears in the
-- owner's gallery instead of an orphan account.

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  google_sub  TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL,
  name        TEXT,
  picture     TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions (user_id);

CREATE TABLE IF NOT EXISTS closets (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT 'My closet',
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_closets_user_id ON closets (user_id);

ALTER TABLE items ADD COLUMN user_id   TEXT;
ALTER TABLE items ADD COLUMN closet_id TEXT;
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items (user_id);

INSERT OR IGNORE INTO users (id, google_sub, email, name)
VALUES ('admin-bootstrap', 'bootstrap-pending', 'bootstrap@local', 'Admin');

INSERT OR IGNORE INTO closets (id, user_id, name)
VALUES ('admin-default-closet', 'admin-bootstrap', 'My closet');

UPDATE items
   SET user_id   = COALESCE(user_id, 'admin-bootstrap'),
       closet_id = COALESCE(closet_id, 'admin-default-closet');
