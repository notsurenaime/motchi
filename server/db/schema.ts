import {
  sqliteTable,
  text,
  integer,
  real,
} from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  avatar: text("avatar").notNull().default("default"),
  pin: text("pin"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const animeCache = sqliteTable("anime_cache", {
  id: text("id").primaryKey(), // AllAnime show ID
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  bannerUrl: text("banner_url"),
  description: text("description"),
  genres: text("genres"), // JSON array
  status: text("status"),
  episodeCount: integer("episode_count"),
  rating: real("rating"),
  cachedAt: integer("cached_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const watchHistory = sqliteTable("watch_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  animeId: text("anime_id").notNull(),
  animeName: text("anime_name").notNull(),
  animeImage: text("anime_image"),
  episodeNumber: text("episode_number").notNull(),
  progress: real("progress").notNull().default(0), // seconds watched
  duration: real("duration").notNull().default(0), // total duration
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const watchlist = sqliteTable("watchlist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  animeId: text("anime_id").notNull(),
  animeName: text("anime_name").notNull(),
  animeImage: text("anime_image"),
  addedAt: integer("added_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const downloads = sqliteTable("downloads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  animeId: text("anime_id").notNull(),
  animeName: text("anime_name").notNull(),
  episodeNumber: text("episode_number").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  status: text("status").notNull().default("pending"), // pending | downloading | complete | error
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
