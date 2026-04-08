import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { animeCache, watchHistory } from "../db/schema.js";
import { eq, and, desc, inArray } from "drizzle-orm";
import { extractBaseName } from "../services/anime-bridge.js";
import {
  getSeriesGroupInfo,
  extractSeasonNumber,
} from "../services/anime-names.js";
import {
  normalizeOptionalText,
  normalizeText,
  parsePositiveInt,
} from "../lib/validation.js";

export async function historyRoutes(app: FastifyInstance) {
  function withLatestAnimeMetadata<
    T extends { animeId: string; animeName: string; animeImage?: string | null }
  >(items: T[]) {
    const cacheRows = items.length
      ? db
          .select()
          .from(animeCache)
          .where(inArray(animeCache.id, items.map((item) => item.animeId)))
          .all()
      : [];
    const cacheById = new Map(cacheRows.map((row) => [row.id, row]));

    return items.map((item) => {
      const cached = cacheById.get(item.animeId);
      const group = cached
        ? getSeriesGroupInfo(extractBaseName(cached.name), cached.name)
        : getSeriesGroupInfo(extractBaseName(item.animeName), item.animeName);

      return {
        ...item,
        animeName: group.displayName,
        animeImage: cached?.imageUrl ?? item.animeImage,
      };
    });
  }

  // Get watch history for a profile
  app.get<{ Params: { profileId: string } }>(
    "/api/profiles/:profileId/history",
    async (req, reply) => {
      const profileId = parsePositiveInt(req.params.profileId);
      if (!profileId) {
        return reply.status(400).send({ error: "Invalid profile id" });
      }
      const history = db
        .select()
        .from(watchHistory)
        .where(eq(watchHistory.profileId, profileId))
        .orderBy(desc(watchHistory.updatedAt))
        .all();

      return withLatestAnimeMetadata(history);
    }
  );

  // Get "Continue Watching" (recent, not fully watched — one entry per anime)
  app.get<{ Params: { profileId: string } }>(
    "/api/profiles/:profileId/continue-watching",
    async (req, reply) => {
      const profileId = parsePositiveInt(req.params.profileId);
      if (!profileId) {
        return reply.status(400).send({ error: "Invalid profile id" });
      }
      const all = db
        .select()
        .from(watchHistory)
        .where(eq(watchHistory.profileId, profileId))
        .orderBy(desc(watchHistory.updatedAt))
        .limit(100)
        .all();

      // Deduplicate: keep only the most recent episode per series (not per animeId,
      // since different seasons have different IDs but belong to the same series)
      const seen = new Set<string>();
      const deduped = all.filter((h) => {
        if (h.duration <= 0 || h.progress / h.duration >= 0.9) return false;
        const key = getSeriesGroupInfo(
          extractBaseName(h.animeName),
          h.animeName
        ).key;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return withLatestAnimeMetadata(deduped.slice(0, 20)).map((h) => ({
        ...h,
        seriesName: getSeriesGroupInfo(
          extractBaseName(h.animeName),
          h.animeName
        ).displayName,
        seasonNumber: extractSeasonNumber(h.animeName),
      }));
    }
  );

  // Update/insert watch progress
  app.post<{
    Body: {
      profileId: number;
      animeId: string;
      animeName: string;
      animeImage?: string;
      episodeNumber: string;
      progress: number;
      duration: number;
    };
  }>("/api/history", async (req, reply) => {
    const profileId = Number.isInteger(req.body?.profileId)
      ? req.body.profileId
      : null;
    const animeId = normalizeText(req.body?.animeId, 80);
    const animeName = normalizeText(req.body?.animeName, 180);
    const animeImage = normalizeOptionalText(req.body?.animeImage, 500);
    const episodeNumber = normalizeText(req.body?.episodeNumber, 20);
    const progress =
      typeof req.body?.progress === "number" && Number.isFinite(req.body.progress)
        ? req.body.progress
        : null;
    const duration =
      typeof req.body?.duration === "number" && Number.isFinite(req.body.duration)
        ? req.body.duration
        : null;

    if (
      !profileId ||
      profileId <= 0 ||
      !animeId ||
      !animeName ||
      !episodeNumber ||
      progress == null ||
      duration == null ||
      duration <= 0
    ) {
      return reply.status(400).send({ error: "Invalid history payload" });
    }

    const safeProgress = Math.max(0, Math.min(progress, duration));

    // Check if entry exists for this profile + anime + episode
    const existing = db
      .select()
      .from(watchHistory)
      .where(
        and(
          eq(watchHistory.profileId, profileId),
          eq(watchHistory.animeId, animeId),
          eq(watchHistory.episodeNumber, episodeNumber)
        )
      )
      .get();

    if (existing) {
      db.update(watchHistory)
        .set({ progress: safeProgress, duration, updatedAt: new Date() })
        .where(eq(watchHistory.id, existing.id))
        .run();
      return { ...existing, progress: safeProgress, duration };
    } else {
      return db
        .insert(watchHistory)
        .values({
          profileId,
          animeId,
          animeName,
          animeImage,
          episodeNumber,
          progress: safeProgress,
          duration,
        })
        .returning()
        .get();
    }
  });
}
