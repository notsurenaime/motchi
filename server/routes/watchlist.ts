import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { watchlist, animeCache } from "../db/schema.js";
import { eq, and, desc, inArray } from "drizzle-orm";
import { extractBaseName } from "../services/anime-bridge.js";
import { getSeriesGroupInfo } from "../services/anime-names.js";
import {
  normalizeOptionalText,
  normalizeText,
  parsePositiveInt,
} from "../lib/validation.js";

export async function watchlistRoutes(app: FastifyInstance) {
  // Get watchlist for a profile
  app.get<{ Params: { profileId: string } }>(
    "/api/profiles/:profileId/watchlist",
    async (req, reply) => {
      const profileId = parsePositiveInt(req.params.profileId);
      if (!profileId) {
        return reply.status(400).send({ error: "Invalid profile id" });
      }

      const items = db
        .select()
        .from(watchlist)
        .where(eq(watchlist.profileId, profileId))
        .orderBy(desc(watchlist.addedAt))
        .all();

      // Enrich with latest cache data
      const cacheRows = items.length
        ? db
            .select()
            .from(animeCache)
            .where(inArray(animeCache.id, items.map((i) => i.animeId)))
            .all()
        : [];
      const cacheById = new Map(cacheRows.map((r) => [r.id, r]));

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
  );

  // Add to watchlist
  app.post<{
    Params: { profileId: string };
    Body: { animeId: string; animeName: string; animeImage?: string };
  }>("/api/profiles/:profileId/watchlist", async (req, reply) => {
    const profileId = parsePositiveInt(req.params.profileId);
    if (!profileId) {
      return reply.status(400).send({ error: "Invalid profile id" });
    }

    const animeId = normalizeText(req.body?.animeId, 80);
    const animeName = normalizeText(req.body?.animeName, 180);
    const animeImage = normalizeOptionalText(req.body?.animeImage, 500);

    if (!animeId || !animeName) {
      return reply.status(400).send({ error: "animeId and animeName are required" });
    }

    // Check if already in watchlist
    const existing = db
      .select()
      .from(watchlist)
      .where(
        and(
          eq(watchlist.profileId, profileId),
          eq(watchlist.animeId, animeId)
        )
      )
      .get();

    if (existing) {
      return existing;
    }

    return db
      .insert(watchlist)
      .values({ profileId, animeId, animeName, animeImage })
      .returning()
      .get();
  });

  // Remove from watchlist
  app.delete<{ Params: { profileId: string; animeId: string } }>(
    "/api/profiles/:profileId/watchlist/:animeId",
    async (req, reply) => {
      const profileId = parsePositiveInt(req.params.profileId);
      if (!profileId) {
        return reply.status(400).send({ error: "Invalid profile id" });
      }

      const animeId = req.params.animeId;
      if (!animeId) {
        return reply.status(400).send({ error: "Invalid anime id" });
      }

      db.delete(watchlist)
        .where(
          and(
            eq(watchlist.profileId, profileId),
            eq(watchlist.animeId, animeId)
          )
        )
        .run();

      return { deleted: true };
    }
  );

  // Check if anime is in watchlist
  app.get<{ Params: { profileId: string; animeId: string } }>(
    "/api/profiles/:profileId/watchlist/:animeId",
    async (req, reply) => {
      const profileId = parsePositiveInt(req.params.profileId);
      if (!profileId) {
        return reply.status(400).send({ error: "Invalid profile id" });
      }

      const existing = db
        .select()
        .from(watchlist)
        .where(
          and(
            eq(watchlist.profileId, profileId),
            eq(watchlist.animeId, req.params.animeId)
          )
        )
        .get();

      return { inWatchlist: !!existing };
    }
  );
}
