import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { animeCache, watchHistory } from "../db/schema.js";
import { eq, and, desc, inArray } from "drizzle-orm";
import { extractBaseName, getAnimeDetail } from "../services/anime-bridge.js";
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
  function parseHistoryBody(body: unknown) {
    if (typeof body === "string") {
      try {
        const parsed = JSON.parse(body);
        return typeof parsed === "object" && parsed !== null ? parsed : null;
      } catch {
        return null;
      }
    }

    return typeof body === "object" && body !== null ? body : null;
  }

  function withLatestAnimeMetadata<
    T extends {
      animeId: string;
      animeName: string;
      animeImage?: string | null;
      episodeImage?: string | null;
    }
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

  async function withEpisodeMetadata<
    T extends {
      id: number;
      animeId: string;
      episodeNumber: string;
      episodeImage?: string | null;
    }
  >(items: T[]) {
    const detailRequests = new Map<string, ReturnType<typeof getAnimeDetail>>();

    return Promise.all(
      items.map(async (item) => {
        let detailRequest = detailRequests.get(item.animeId);
        if (!detailRequest) {
          detailRequest = getAnimeDetail(item.animeId).catch(() => null as any);
          detailRequests.set(item.animeId, detailRequest);
        }

        const detail = await detailRequest;
        const episodeDetail = detail?.episodeDetails?.find(
          (episode) => episode.episode === item.episodeNumber
        );
        const episodeImage = episodeDetail?.image;

        if (episodeImage && !item.episodeImage) {
          db.update(watchHistory)
            .set({ episodeImage })
            .where(eq(watchHistory.id, item.id))
            .run();
        }

        return {
          ...item,
          episodeImage: item.episodeImage ?? episodeImage,
          episodeTitle: episodeDetail?.title,
          episodeDescription: episodeDetail?.description,
        };
      })
    );
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
        .limit(500)
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

      const enriched = await withEpisodeMetadata(deduped.slice(0, 20));

      return withLatestAnimeMetadata(enriched).map((h) => ({
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
    Body: unknown;
  }>("/api/history", async (req, reply) => {
    const body = parseHistoryBody(req.body);

    const profileId = body?.profileId;
    const normalizedProfileId = Number.isInteger(profileId) ? profileId : null;
    const animeId = normalizeText(body?.animeId, 80);
    const animeName = normalizeText(body?.animeName, 180);
    const animeImage = normalizeOptionalText(body?.animeImage, 500);
    const episodeImage = normalizeOptionalText(body?.episodeImage, 500);
    const episodeNumber = normalizeText(body?.episodeNumber, 20);
    const progress =
      typeof body?.progress === "number" && Number.isFinite(body.progress)
        ? body.progress
        : null;
    const duration =
      typeof body?.duration === "number" && Number.isFinite(body.duration)
        ? body.duration
        : null;

    if (
      !normalizedProfileId ||
      normalizedProfileId <= 0 ||
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
          eq(watchHistory.profileId, normalizedProfileId),
          eq(watchHistory.animeId, animeId),
          eq(watchHistory.episodeNumber, episodeNumber)
        )
      )
      .get();

    if (existing) {
      const now = new Date();
      db.update(watchHistory)
        .set({ progress: safeProgress, duration, animeImage, episodeImage, updatedAt: now })
        .where(eq(watchHistory.id, existing.id))
        .run();
      return {
        ...existing,
        progress: safeProgress,
        duration,
        animeImage,
        episodeImage,
        updatedAt: now,
      };
    } else {
      return db
        .insert(watchHistory)
        .values({
          profileId: normalizedProfileId,
          animeId,
          animeName,
          animeImage,
          episodeImage,
          episodeNumber,
          progress: safeProgress,
          duration,
        })
        .returning()
        .get();
    }
  });
}
