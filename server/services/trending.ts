import { inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { animeCache } from "../db/schema.js";
import {
  type AnimeSearchResult,
  extractBaseName,
  searchAnime,
} from "./anime-bridge.js";
import { getSeriesGroupInfo } from "./anime-names.js";

interface AniListMedia {
  title: {
    romaji?: string | null;
    english?: string | null;
    userPreferred?: string | null;
  };
  coverImage?: {
    extraLarge?: string | null;
    large?: string | null;
  } | null;
  bannerImage?: string | null;
  description?: string | null;
  episodes?: number | null;
  averageScore?: number | null;
  genres?: string[] | null;
  status?: string | null;
}

interface TrendingAnime {
  id: string;
  name: string;
  imageUrl?: string;
  bannerUrl?: string;
  description?: string;
  genres: string[];
  status?: string;
  episodeCount?: number;
  rating?: number;
}

const ANILIST_TRENDING_QUERY = `
  query ($page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
        title {
          romaji
          english
          userPreferred
        }
        coverImage {
          extraLarge
          large
        }
        bannerImage
        description(asHtml: false)
        episodes
        averageScore
        genres
        status
      }
    }
  }
`;

const TRENDING_TTL_MS = 60 * 60 * 1000;

let trendingCache:
  | {
      expiresAt: number;
      data: TrendingAnime[];
    }
  | undefined;

function normalizeAniListStatus(status?: string | null) {
  switch (status) {
    case "RELEASING":
      return "Ongoing";
    case "FINISHED":
      return "Completed";
    case "NOT_YET_RELEASED":
      return "Upcoming";
    default:
      return status ?? undefined;
  }
}

function getMediaTitles(media: AniListMedia) {
  return Array.from(
    new Set(
      [media.title.english, media.title.userPreferred, media.title.romaji]
        .map((title) => title?.trim())
        .filter((title): title is string => Boolean(title))
    )
  );
}

function scoreMatch(media: AniListMedia, result: AnimeSearchResult) {
  const resultGroup = getSeriesGroupInfo(
    extractBaseName(result.name),
    result.name
  ).key;

  let score = 0;
  for (const title of getMediaTitles(media)) {
    const mediaGroup = getSeriesGroupInfo(extractBaseName(title), title).key;
    if (mediaGroup === resultGroup) {
      score += 100;
    }

    const lowerTitle = title.toLowerCase();
    const lowerResult = result.name.toLowerCase();
    if (lowerResult === lowerTitle) {
      score += 40;
    } else if (lowerResult.startsWith(lowerTitle)) {
      score += 20;
    }
  }

  score += Math.min(result.episodeCount ?? 0, 100) / 10;
  return score;
}

async function findMatchingAnime(media: AniListMedia) {
  let bestMatch:
    | {
        result: AnimeSearchResult;
        score: number;
      }
    | undefined;

  for (const title of getMediaTitles(media)) {
    const results = await searchAnime(title, "sub", 1, 6);
    for (const result of results) {
      const score = scoreMatch(media, result);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { result, score };
      }
    }
  }

  if (!bestMatch || bestMatch.score < 100) {
    return undefined;
  }

  return bestMatch.result;
}

export async function getCurrentTrendingAnime() {
  if (trendingCache && trendingCache.expiresAt > Date.now()) {
    return trendingCache.data;
  }

  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: ANILIST_TRENDING_QUERY,
      variables: { page: 1, perPage: 16 },
    }),
  });

  if (!response.ok) {
    throw new Error(`AniList trending request failed: ${response.status}`);
  }

  const json = await response.json();
  const mediaList = (json?.data?.Page?.media ?? []) as AniListMedia[];
  const matched = await Promise.all(
    mediaList.map(async (media) => {
      const match = await findMatchingAnime(media);
      if (!match) {
        return undefined;
      }

      return {
        match,
        media,
        group: getSeriesGroupInfo(extractBaseName(match.name), match.name),
      };
    })
  );

  const resolved = matched.filter(
    (
      entry
    ): entry is {
      match: AnimeSearchResult;
      media: AniListMedia;
      group: { key: string; displayName: string };
    } => Boolean(entry)
  );

  const cacheIds = resolved.map((entry) => entry.match.id);
  const cachedRows = cacheIds.length
    ? db
        .select()
        .from(animeCache)
        .where(inArray(animeCache.id, cacheIds))
        .all()
    : [];
  const cachedById = new Map(cachedRows.map((row) => [row.id, row]));

  const deduped = new Map<string, TrendingAnime>();
  for (const entry of resolved) {
    const cached = cachedById.get(entry.match.id);
    if (deduped.has(entry.group.key)) {
      continue;
    }

    deduped.set(entry.group.key, {
      id: entry.match.id,
      name: entry.group.displayName,
      imageUrl:
        cached?.imageUrl ??
        entry.media.coverImage?.extraLarge ??
        entry.media.coverImage?.large ??
        entry.match.thumbnail,
      bannerUrl: cached?.bannerUrl ?? entry.media.bannerImage ?? undefined,
      description: cached?.description ?? entry.media.description ?? undefined,
      genres: cached?.genres ? JSON.parse(cached.genres) : entry.media.genres ?? [],
      status: cached?.status ?? normalizeAniListStatus(entry.media.status),
      episodeCount:
        cached?.episodeCount ?? entry.media.episodes ?? entry.match.episodeCount,
      rating:
        cached?.rating ??
        (typeof entry.media.averageScore === "number"
          ? entry.media.averageScore / 10
          : undefined),
    });
  }

  const data = Array.from(deduped.values()).slice(0, 12);
  trendingCache = {
    expiresAt: Date.now() + TRENDING_TTL_MS,
    data,
  };

  return data;
}