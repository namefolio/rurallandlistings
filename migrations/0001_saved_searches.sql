-- Saved searches with optional email alerts. No accounts: each row is one email + one search,
-- confirmed by a link (double opt-in) and removed by the unsubscribe link in every alert.
-- The Worker also applies this schema itself on first use (src/saved-searches.ts), so this file is for reference
-- and for `wrangler d1 execute rurallandlistings-production --remote --file migrations/0001_saved_searches.sql`.
CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  last_checked TEXT NOT NULL,
  last_sent_at TEXT,
  -- Site origin the search was saved on, so alert links point at the same host.
  origin TEXT NOT NULL DEFAULT 'https://rurallandlistings.com',
  -- Listing URLs already emailed for this search (newest 200), so nothing is sent twice.
  sent_urls TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS saved_searches_email ON saved_searches (email);
CREATE INDEX IF NOT EXISTS saved_searches_confirmed ON saved_searches (confirmed_at);
