import { FastifyInstance } from "fastify";
import { Readable } from "stream";
import {
  searchAnime,
  getAnimeDetail,
  getEpisodeStreams,
  getBestStreamUrl,
  getAnimeCatalogTotal,
  findRelatedSeasons,
  extractBaseName,
} from "../services/anime-bridge.js";
import { getSeriesGroupInfo } from "../services/anime-names.js";
import { db } from "../db/index.js";
import { animeCache } from "../db/schema.js";
import { desc, like, inArray } from "drizzle-orm";
import { getCurrentTrendingAnime } from "../services/trending.js";
import {
  escapeLikePattern,
  isAllowedProxyUrl,
  isValidEpisodeNumber,
  normalizeText,
  parsePositiveInt,
  validateMode,
} from "../lib/validation.js";

export async function animeRoutes(app: FastifyInstance) {
  const allowedProxyHosts = [
    "tools.fast4speed.rsvp",
    "myanime.sharepoint.com",
    "repackager.wixmp.com",
    "allanime.day",
  ];
  const narutoSearchOrder: Record<string, number> = {
    "naruto extras": 1,
    "naruto shippuden": 2,
    naruto: 3,
    boruto: 4,
  };

  const getPreferredEpisodeCount = (
    liveCount?: number,
    cachedCount?: number | null
  ) => {
    if (typeof liveCount === "number" && liveCount > 0) {
      return liveCount;
    }

    return cachedCount ?? 0;
  };

  const parseGenres = (genres: string | null, fallback: string[] = []) => {
    if (!genres) {
      return fallback;
    }

    try {
      return JSON.parse(genres) as string[];
    } catch {
      return fallback;
    }
  };

  const formatUpstreamSearchEntry = (
    entry: Awaited<ReturnType<typeof searchAnime>>[number],
    cached?: typeof animeCache.$inferSelect,
    overrides?: Partial<{
      id: string;
      name: string;
      thumbnail?: string;
      description?: string;
      status?: string;
      episodeCount: number;
      genres: string[];
    }>
  ) => ({
    id: overrides?.id ?? entry.id,
    name: overrides?.name ?? entry.name,
    thumbnail: overrides?.thumbnail ?? cached?.imageUrl ?? entry.thumbnail,
    description: overrides?.description ?? cached?.description ?? entry.description,
    status: overrides?.status ?? cached?.status ?? entry.status,
    episodeCount:
      overrides?.episodeCount ??
      getPreferredEpisodeCount(entry.episodeCount, cached?.episodeCount),
    genres: overrides?.genres ?? parseGenres(cached?.genres ?? null, entry.genres ?? []),
  });

  const groupNarutoSearchResults = (
    rows: Awaited<ReturnType<typeof searchAnime>>,
    cacheById: Map<string, typeof animeCache.$inferSelect>
  ) => {
    const grouped = new Map<
      string,
      ReturnType<typeof formatUpstreamSearchEntry> & { sortOrder: number }
    >();

    for (const entry of rows) {
      const group = getSeriesGroupInfo(extractBaseName(entry.name), entry.name);
      const sortOrder = narutoSearchOrder[group.key];
      if (sortOrder === undefined) {
        continue;
      }

      const formatted = formatUpstreamSearchEntry(entry, cacheById.get(entry.id), {
        name: group.displayName,
      });
      const existing = grouped.get(group.key);

      if (
        !existing ||
        formatted.episodeCount > existing.episodeCount ||
        (!!formatted.thumbnail && !existing.thumbnail)
      ) {
        grouped.set(group.key, { ...formatted, sortOrder });
      }
    }

    return Array.from(grouped.values())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ sortOrder, ...entry }) => entry);
  };

  /** Group cached anime rows by series, applying proper display names */
  function groupBySeries(rows: typeof animeCache.$inferSelect[]) {
    const groups = new Map<string, {
      entry: typeof animeCache.$inferSelect;
      displayName: string;
      totalEpisodes: number;
      bestRating: number;
    }>();

    const isBetterRepresentative = (
      candidate: typeof animeCache.$inferSelect,
      current: typeof animeCache.$inferSelect
    ) => {
      if (candidate.bannerUrl && !current.bannerUrl) return true;
      if (candidate.imageUrl && !current.imageUrl) return true;

      const candidateTime = candidate.cachedAt instanceof Date
        ? candidate.cachedAt.getTime()
        : new Date(candidate.cachedAt).getTime();
      const currentTime = current.cachedAt instanceof Date
        ? current.cachedAt.getTime()
        : new Date(current.cachedAt).getTime();

      if (candidateTime !== currentTime) {
        return candidateTime > currentTime;
      }

      return (candidate.episodeCount ?? 0) > (current.episodeCount ?? 0);
    };

    for (const a of rows) {
      const baseName = extractBaseName(a.name);
      const group = getSeriesGroupInfo(baseName, a.name);
      const key = group.key;
      const displayName = group.displayName;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          entry: a,
          displayName,
          totalEpisodes: a.episodeCount ?? 0,
          bestRating: a.rating ?? 0,
        });
      } else {
        existing.totalEpisodes += a.episodeCount ?? 0;
        // Use the highest rating from any entry in the group
        if ((a.rating ?? 0) > existing.bestRating) {
          existing.bestRating = a.rating ?? 0;
        }
        if (isBetterRepresentative(a, existing.entry)) {
          existing.entry = a;
        }
      }
    }

    return Array.from(groups.values());
  }

  // Search anime — local-first, then API fallback
  app.get<{ Querystring: { q: string; mode?: "sub" | "dub" } }>(
    "/api/anime/search",
    async (req, reply) => {
      const { q } = req.query;
      if (!q || q.trim().length === 0) {
        return reply.status(400).send({ error: "Query parameter 'q' required" });
      }

      const term = q.trim().slice(0, 100);
      const mode = validateMode(req.query.mode);
      const isNarutoFamilySearch = /\b(naruto|nato|boruto)\b/i.test(term);

      const upstream = isNarutoFamilySearch
        ? (
            await Promise.all(
              [
                "Road of Naruto",
                "Naruto Shippuden",
                "NARUTO -ナルト-",
                "Boruto",
              ].map((searchTerm) => searchAnime(searchTerm, mode, 1, 40))
            )
          ).flat()
        : await searchAnime(term, mode);

      const dedupedUpstream = Array.from(
        new Map(upstream.map((entry) => [entry.id, entry])).values()
      );

      if (dedupedUpstream.length > 0) {
        const cacheRows = db
          .select()
          .from(animeCache)
          .where(inArray(animeCache.id, dedupedUpstream.map((entry) => entry.id)))
          .all();
        const cacheById = new Map(cacheRows.map((row) => [row.id, row]));

        if (isNarutoFamilySearch) {
          const narutoResults = groupNarutoSearchResults(dedupedUpstream, cacheById);
          if (narutoResults.length > 0) {
            return narutoResults;
          }
        }

        return dedupedUpstream.map((entry) =>
          formatUpstreamSearchEntry(entry, cacheById.get(entry.id))
        );
      }

      // Fall back to the local cache when upstream search yields no results.
      const cached = db
        .select()
        .from(animeCache)
        .where(like(animeCache.name, `%${escapeLikePattern(term)}%`))
        .orderBy(desc(animeCache.rating))
        .limit(40)
        .all();

      if (cached.length > 0) {
        return groupBySeries(cached)
          .sort((a, b) => b.bestRating - a.bestRating)
          .slice(0, 20)
          .map(({ entry: a, displayName, totalEpisodes, bestRating }) => ({
            id: a.id,
            name: displayName,
            thumbnail: a.imageUrl,
            description: a.description,
            status: a.status,
            episodeCount: totalEpisodes,
            genres: a.genres ? JSON.parse(a.genres) : [],
          }));
      }

      // No local results — fall back to API
      const results = await searchAnime(term, mode);
      return results;
    }
  );

  /** Format a grouped entry into the consistent API response shape */
  function formatGrouped({ entry: a, displayName, totalEpisodes, bestRating }: ReturnType<typeof groupBySeries>[number]) {
    return {
      id: a.id,
      name: displayName,
      imageUrl: a.imageUrl,
      bannerUrl: a.bannerUrl,
      description: a.description,
      genres: a.genres ? JSON.parse(a.genres) : [],
      status: a.status,
      episodeCount: totalEpisodes,
      rating: bestRating,
      cachedAt: a.cachedAt,
    };
  }

  // Get cached/trending anime for homepage — deduplicated
  app.get("/api/anime/trending", async () => {
    try {
      const liveTrending = await getCurrentTrendingAnime();
      if (liveTrending.length > 0) {
        return liveTrending;
      }
    } catch {
      // Fall back to the local cache if the live feed fails.
    }

    const all = db.select().from(animeCache).all();
    return groupBySeries(all)
      .sort((a, b) => b.bestRating - a.bestRating)
      .slice(0, 24)
      .map(formatGrouped);
  });

  // Browse anime using upstream paged results with optional filters.
  app.get<{ Querystring: { genre?: string; status?: string; page?: string; limit?: string } }>(
    "/api/anime/browse",
    async (req, reply) => {
      const { genre, status } = req.query;
      const normalizedPage = req.query.page
        ? parsePositiveInt(req.query.page)
        : null;
      const normalizedLimit = req.query.limit
        ? parsePositiveInt(req.query.limit)
        : null;
      const page = normalizedPage ?? 1;
      const limit = normalizedLimit ? Math.min(normalizedLimit, 48) : 36;
      let normalizedGenre: string | undefined;
      let normalizedStatus: string | undefined;

      if (genre) {
        normalizedGenre = normalizeText(genre, 60) ?? undefined;
        if (!normalizedGenre) {
          return reply.status(400).send({ error: "Invalid genre filter" });
        }
      }

      if (status) {
        normalizedStatus = normalizeText(status, 30) ?? undefined;
        if (!normalizedStatus) {
          return reply.status(400).send({ error: "Invalid status filter" });
        }
      }

      const upstream = await searchAnime("", "sub", page, limit);
      const filtered = upstream.filter((entry) => {
        const genreMatches =
          !normalizedGenre || entry.genres?.includes(normalizedGenre);
        const statusMatches = !normalizedStatus || entry.status === normalizedStatus;
        return genreMatches && statusMatches;
      });

      const cacheRows = filtered.length
        ? db
            .select()
            .from(animeCache)
            .where(inArray(animeCache.id, filtered.map((entry) => entry.id)))
            .all()
        : [];
      const cacheById = new Map(cacheRows.map((row) => [row.id, row]));
      const totalAvailable = await getAnimeCatalogTotal("sub", {
        allowStale: true,
      });

      return {
        items: filtered.map((entry) => {
          const cached = cacheById.get(entry.id);
          const group = getSeriesGroupInfo(extractBaseName(entry.name), entry.name);

          return {
            id: entry.id,
            name: group.displayName,
            imageUrl: cached?.imageUrl ?? entry.thumbnail,
            bannerUrl: cached?.bannerUrl ?? undefined,
            description: cached?.description ?? entry.description,
            genres: parseGenres(cached?.genres ?? null, entry.genres ?? []),
            status: cached?.status ?? entry.status,
            episodeCount: getPreferredEpisodeCount(
              entry.episodeCount,
              cached?.episodeCount
            ),
            rating: cached?.rating ?? undefined,
          };
        }),
        page,
        hasMore: upstream.length === limit,
        totalAvailable,
      };
    }
  );

  // Get anime detail
  app.get<{ Params: { id: string }; Querystring: { mode?: "sub" | "dub" } }>(
    "/api/anime/:id",
    async (req, reply) => {
      const id = normalizeText(req.params.id, 80);
      if (!id) return reply.status(400).send({ error: "Invalid anime id" });
      const mode = validateMode(req.query.mode);
      const detail = await getAnimeDetail(id, mode);
      return detail;
    }
  );

  // Get related seasons for an anime
  app.get<{ Params: { id: string }; Querystring: { mode?: "sub" | "dub" } }>(
    "/api/anime/:id/seasons",
    async (req, reply) => {
      const id = normalizeText(req.params.id, 80);
      if (!id) return reply.status(400).send({ error: "Invalid anime id" });
      const mode = validateMode(req.query.mode);
      const detail = await getAnimeDetail(id, mode);
      const seasons = await findRelatedSeasons(detail.name, mode);
      return seasons;
    }
  );

  // Get episode stream links
  app.get<{
    Params: { id: string; episode: string };
    Querystring: { mode?: "sub" | "dub" };
  }>("/api/anime/:id/episode/:episode/streams", async (req, reply) => {
    const id = normalizeText(req.params.id, 80);
    if (!id) return reply.status(400).send({ error: "Invalid anime id" });
    if (!isValidEpisodeNumber(req.params.episode)) return reply.status(400).send({ error: "Invalid episode number" });
    const episode = req.params.episode.trim();
    const mode = validateMode(req.query.mode);
    const streams = await getEpisodeStreams(id, episode, mode);
    return streams;
  });

  // Get best stream URL for quick playback
  app.get<{
    Params: { id: string; episode: string };
    Querystring: { quality?: string; mode?: "sub" | "dub" };
  }>("/api/anime/:id/episode/:episode/play", async (req, reply) => {
    const id = normalizeText(req.params.id, 80);
    if (!id) return reply.status(400).send({ error: "Invalid anime id" });
    if (!isValidEpisodeNumber(req.params.episode)) return reply.status(400).send({ error: "Invalid episode number" });
    const episode = req.params.episode.trim();
    const mode = validateMode(req.query.mode);
    const quality = normalizeText(req.query.quality ?? "1080p", 10) ?? "1080p";
    const best = await getBestStreamUrl(id, episode, quality, mode);
    if (!best) {
      return reply.status(404).send({ error: "No streams found" });
    }
    return best;
  });

  // Proxy stream to add required headers (Referer, User-Agent)
  app.get<{ Querystring: { url: string; referer?: string } }>(
    "/api/proxy/stream",
    async (req, reply) => {
      const { url, referer } = req.query;
      if (!url) {
        return reply.status(400).send({ error: "Missing url parameter" });
      }

      const target = isAllowedProxyUrl(url, allowedProxyHosts);
      if (!target.ok) {
        return reply.status(403).send({ error: target.reason });
      }

      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
      };
      if (referer) headers["Referer"] = referer;

      // Forward Range header for seeking support
      const range = req.headers.range;
      if (range) headers["Range"] = range;

      const upstream = await fetch(target.url, { headers });

      reply.status(upstream.status);
      reply.header("Content-Type", upstream.headers.get("Content-Type") ?? "application/octet-stream");
      // Only claim range support if upstream actually supports it
      if (upstream.status === 206 || upstream.headers.get("accept-ranges")?.toLowerCase() === "bytes") {
        reply.header("Accept-Ranges", "bytes");
      }
      if (upstream.headers.has("Content-Length"))
        reply.header("Content-Length", upstream.headers.get("Content-Length")!);
      if (upstream.headers.has("Content-Range"))
        reply.header("Content-Range", upstream.headers.get("Content-Range")!);

      if (!upstream.body) {
        return reply.send(Buffer.alloc(0));
      }
      // Convert web ReadableStream to Node.js Readable for reliable Fastify piping
      const nodeStream = Readable.fromWeb(upstream.body as import("stream/web").ReadableStream);
      // Attach an error listener immediately — if an error fires before Fastify's
      // reply.send() attaches its own handler, an unhandled 'error' event would crash the process.
      nodeStream.on("error", () => {});
      return reply.send(nodeStream);
    }
  );

}
