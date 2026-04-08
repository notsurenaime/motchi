import { sqlite } from "./index.js";

// Run migrations inline for simplicity — creates tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT 'default',
    pin TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS anime_cache (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    image_url TEXT,
    banner_url TEXT,
    description TEXT,
    genres TEXT,
    status TEXT,
    episode_count INTEGER,
    rating REAL,
    cached_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS watch_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    anime_id TEXT NOT NULL,
    anime_name TEXT NOT NULL,
    anime_image TEXT,
    episode_number TEXT NOT NULL,
    progress REAL NOT NULL DEFAULT 0,
    duration REAL NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anime_id TEXT NOT NULL,
    anime_name TEXT NOT NULL,
    episode_number TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Create default profile if none exists
  INSERT OR IGNORE INTO profiles (id, name, avatar) VALUES (1, 'Default', 'default');
`);

// Create watchlist table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    anime_id TEXT NOT NULL,
    anime_name TEXT NOT NULL,
    anime_image TEXT,
    added_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(profile_id, anime_id)
  );
`);

// Add error_message column if missing (migration for existing DBs)
try {
  sqlite.exec(`ALTER TABLE downloads ADD COLUMN error_message TEXT`);
} catch { /* column already exists */ }

console.log("Database migrated successfully");
