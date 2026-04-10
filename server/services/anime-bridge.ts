/**
 * Anime Bridge Service
 * Directly interfaces with the AllAnime GraphQL API — the same backend ani-cli uses.
 * This replaces the need to exec ani-cli as a child process.
 */

import { getSeriesGroupInfo } from "./anime-names.js";
import { db } from "../db/index.js";
import { animeCatalogTotals } from "../db/schema.js";
import { eq } from "drizzle-orm";

const AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0";
const ALLANIME_REFR = "https://allmanga.to";
const ALLANIME_BASE = "allanime.day";
const ALLANIME_API = `https://api.${ALLANIME_BASE}`;

// GraphQL queries (extracted from ani-cli source)
const SEARCH_GQL = `query( $search: SearchInput $limit: Int $page: Int $translationType: VaildTranslationTypeEnumType $countryOrigin: VaildCountryOriginEnumType ) { shows( search: $search limit: $limit page: $page translationType: $translationType countryOrigin: $countryOrigin ) { edges { _id name thumbnail description airedStart status availableEpisodes genres __typename } }}`;

const EPISODES_LIST_GQL = `query ($showId: String!) { show( _id: $showId ) { _id availableEpisodesDetail }}`;

const EPISODE_INFO_GQL = `query ($showId: String!, $episodeNumStart: Float!, $episodeNumEnd: Float!) { episodeInfos(showId: $showId, episodeNumStart: $episodeNumStart, episodeNumEnd: $episodeNumEnd) { episodeIdNum notes description thumbnails } }`;

const EPISODE_EMBED_GQL = `query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) { episode( showId: $showId translationType: $translationType episodeString: $episodeString ) { episodeString sourceUrls }}`;

const SHOW_DETAIL_GQL = `query ($showId: String!) { show( _id: $showId ) { _id name thumbnail description airedStart status availableEpisodes genres __typename } }`;

const COUNT_GQL = `query( $search: SearchInput $limit: Int $page: Int $translationType: VaildTranslationTypeEnumType $countryOrigin: VaildCountryOriginEnumType ) { shows( search: $search limit: $limit page: $page translationType: $translationType countryOrigin: $countryOrigin ) { pageInfo { hasNextPage nextPage } edges { _id } } }`;

const COUNT_SEASONS = ["Winter", "Spring", "Summer", "Fall"] as const;
const COUNT_TYPES = ["TV", "Movie", "ONA", "OVA", "Special", "PV"] as const;
const COUNT_START_YEAR = 1917;
const COUNT_CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const COUNT_STALE_FALLBACK_MS = 1000 * 60 * 60 * 24 * 30;

type TranslationMode = "sub" | "dub";

const animeCatalogTotalCache = new Map<
  TranslationMode,
  { total: number; expiresAt: number }
>();
const animeCatalogTotalPromises = new Map<TranslationMode, Promise<number>>();

export interface AnimeSearchResult {
  id: string;
  name: string;
  thumbnail?: string;
  description?: string;
  status?: string;
  episodeCount: number;
  genres?: string[];
}

export interface AnimeDetail {
  id: string;
  name: string;
  thumbnail?: string;
  banner?: string;
  description?: string;
  status?: string;
  episodeCount: number;
  genres?: string[];
  rating?: number;
  episodes: string[];
  episodeDetails?: EpisodeDetail[];
  seasons?: SeasonInfo[];
}

export interface EpisodeDetail {
  episode: string;
  title?: string;
  description?: string;
  image?: string;
}

export interface SeasonInfo {
  id: string;
  name: string;
  episodeCount: number;
  order: number;
}

export interface StreamLink {
  quality: string;
  url: string;
  type: "mp4" | "m3u8";
  referer?: string;
  subtitleUrl?: string;
}

async function gqlRequest(query: string, variables: Record<string, unknown>) {
  const res = await fetch(`${ALLANIME_API}/api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": AGENT,
      Referer: ALLANIME_REFR,
    },
    body: JSON.stringify({ variables, query }),
  });
  if (!res.ok) throw new Error(`AllAnime API error: ${res.status}`);
  return res.json();
}

async function fetchCatalogPartitionIds(
  search: Record<string, unknown>,
  mode: "sub" | "dub" = "sub"
) {
  let page = 1;
  const ids = new Set<string>();

  while (true) {
    const data = await gqlRequest(COUNT_GQL, {
      search,
      limit: 40,
      page,
      translationType: mode,
      countryOrigin: "ALL",
    });

    const shows = data?.data?.shows;
    const edges = shows?.edges ?? [];
    for (const edge of edges) {
      if (edge?._id) {
        ids.add(edge._id);
      }
    }

    if (!shows?.pageInfo?.hasNextPage || !shows?.pageInfo?.nextPage) {
      break;
    }

    page = shows.pageInfo.nextPage;
  }

  return ids;
}

async function computeAnimeCatalogTotal(mode: "sub" | "dub" = "sub") {
  const ids = new Set<string>();
  const currentYear = new Date().getFullYear() + 1;

  for (let year = COUNT_START_YEAR; year <= currentYear; year += 1) {
    const baseSearch = {
      allowAdult: false,
      allowUnknown: false,
      query: "",
      year,
    };
    const yearIds = await fetchCatalogPartitionIds(baseSearch, mode);

    if (yearIds.size === 0) {
      continue;
    }

    if (yearIds.size < 80) {
      for (const id of yearIds) {
        ids.add(id);
      }
      continue;
    }

    for (const type of COUNT_TYPES) {
      const typeIds = await fetchCatalogPartitionIds(
        {
          ...baseSearch,
          types: [type],
        },
        mode
      );

      if (typeIds.size === 0) {
        continue;
      }

      if (typeIds.size < 80) {
        for (const id of typeIds) {
          ids.add(id);
        }
        continue;
      }

      for (const season of COUNT_SEASONS) {
        const seasonTypeIds = await fetchCatalogPartitionIds(
          {
            ...baseSearch,
            season,
            types: [type],
          },
          mode
        );

        for (const id of seasonTypeIds) {
          ids.add(id);
        }
      }
    }
  }

  return ids.size;
}

function loadPersistedAnimeCatalogTotal(mode: TranslationMode) {
  return (
    db
      .select()
      .from(animeCatalogTotals)
      .where(eq(animeCatalogTotals.mode, mode))
      .get() ?? null
  );
}

function persistAnimeCatalogTotal(mode: TranslationMode, total: number) {
  db.insert(animeCatalogTotals)
    .values({ mode, total, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: animeCatalogTotals.mode,
      set: { total, updatedAt: new Date() },
    })
    .run();
}

function startAnimeCatalogTotalRefresh(mode: TranslationMode) {
  const existingPromise = animeCatalogTotalPromises.get(mode);
  if (existingPromise) {
    return existingPromise;
  }

  const refreshPromise = computeAnimeCatalogTotal(mode)
    .then((total) => {
      animeCatalogTotalCache.set(mode, {
        total,
        expiresAt: Date.now() + COUNT_CACHE_TTL_MS,
      });
      persistAnimeCatalogTotal(mode, total);
      return total;
    })
    .finally(() => {
      animeCatalogTotalPromises.delete(mode);
    });

  animeCatalogTotalPromises.set(mode, refreshPromise);
  return refreshPromise;
}

export async function getAnimeCatalogTotal(
  mode: TranslationMode = "sub",
  options?: { allowStale?: boolean }
) {
  const allowStale = options?.allowStale ?? false;
  const now = Date.now();
  const cached = animeCatalogTotalCache.get(mode);
  if (cached && cached.expiresAt > now) {
    return cached.total;
  }

  const persisted = loadPersistedAnimeCatalogTotal(mode);
  if (persisted) {
    const updatedAt =
      persisted.updatedAt instanceof Date
        ? persisted.updatedAt.getTime()
        : new Date(persisted.updatedAt).getTime();
    const expiresAt = updatedAt + COUNT_CACHE_TTL_MS;
    animeCatalogTotalCache.set(mode, {
      total: persisted.total,
      expiresAt,
    });

    if (expiresAt > now) {
      return persisted.total;
    }

    if (allowStale && now - updatedAt <= COUNT_STALE_FALLBACK_MS) {
      void startAnimeCatalogTotalRefresh(mode);
      return persisted.total;
    }
  }

  if (allowStale) {
    if (cached) {
      void startAnimeCatalogTotalRefresh(mode);
      return cached.total;
    }

    void startAnimeCatalogTotalRefresh(mode);
    return 0;
  }

  return startAnimeCatalogTotalRefresh(mode);
}

export function warmAnimeCatalogTotal(mode: TranslationMode = "sub") {
  void getAnimeCatalogTotal(mode, { allowStale: true });
}

function resolveImageUrl(url?: string) {
  if (!url) return undefined;
  return url.startsWith("http")
    ? url
    : `https://wp.youtube-anime.com/aln.youtube-anime.com/${url.replace(/^\//, "")}`;
}

function getEpisodeTitle(notes?: string) {
  if (!notes) return undefined;
  const [title] = notes.split("<note-split>");
  const normalizedTitle = title?.trim();
  return normalizedTitle ? normalizedTitle : undefined;
}

function getPreferredEpisodeImage(
  thumbnails: string[] | undefined,
  mode: "sub" | "dub"
) {
  if (!thumbnails?.length) return undefined;

  const preferred = thumbnails.find((thumbnail) =>
    thumbnail.toLowerCase().includes(`_${mode}.`)
  );

  return resolveImageUrl(preferred ?? thumbnails[0]);
}

async function getEpisodeDetails(
  showId: string,
  episodes: string[],
  mode: "sub" | "dub"
): Promise<EpisodeDetail[]> {
  const numericEpisodeMap = new Map<number, string>();

  for (const episode of episodes) {
    const episodeNumber = Number(episode);
    if (Number.isFinite(episodeNumber)) {
      numericEpisodeMap.set(episodeNumber, episode);
    }
  }

  if (numericEpisodeMap.size === 0) {
    return [];
  }

  const numericEpisodes = Array.from(numericEpisodeMap.keys()).sort((a, b) => a - b);
  const episodeInfoData = await gqlRequest(EPISODE_INFO_GQL, {
    showId,
    episodeNumStart: numericEpisodes[0],
    episodeNumEnd: numericEpisodes[numericEpisodes.length - 1],
  });

  const episodeDetailsByEpisode = new Map<string, EpisodeDetail>();
  const episodeInfos = episodeInfoData?.data?.episodeInfos ?? [];
  for (const episodeInfo of episodeInfos) {
    const episodeNumber = Number(episodeInfo.episodeIdNum);
    const originalEpisode = numericEpisodeMap.get(episodeNumber);
    if (!originalEpisode) continue;

    episodeDetailsByEpisode.set(originalEpisode, {
      episode: originalEpisode,
      title: getEpisodeTitle(episodeInfo.notes),
      description: episodeInfo.description ?? undefined,
      image: getPreferredEpisodeImage(episodeInfo.thumbnails, mode),
    });
  }

  return episodes
    .map((episode) => episodeDetailsByEpisode.get(episode))
    .filter((episode): episode is EpisodeDetail => Boolean(episode));
}

/**
 * Search for anime by query string
 */
export async function searchAnime(
  query: string,
  mode: "sub" | "dub" = "sub",
  page = 1,
  limit = 40
): Promise<AnimeSearchResult[]> {
  const data = await gqlRequest(SEARCH_GQL, {
    search: { allowAdult: false, allowUnknown: false, query },
    limit,
    page,
    translationType: mode,
    countryOrigin: "ALL",
  });

  const edges = data?.data?.shows?.edges ?? [];
  return edges.map((edge: any) => ({
    id: edge._id,
    name: edge.name,
    thumbnail: resolveImageUrl(edge.thumbnail),
    description: edge.description,
    status: edge.status,
    episodeCount: edge.availableEpisodes?.[mode] ?? 0,
    genres: edge.genres ?? [],
  }));
}

/**
 * Get detailed info for a specific anime
 */
export async function getAnimeDetail(
  showId: string,
  mode: "sub" | "dub" = "sub"
): Promise<AnimeDetail> {
  const [detailData, episodesData] = await Promise.all([
    gqlRequest(SHOW_DETAIL_GQL, { showId }),
    gqlRequest(EPISODES_LIST_GQL, { showId }),
  ]);

  const show = detailData?.data?.show ?? {};
  const episodeDetail = episodesData?.data?.show?.availableEpisodesDetail;
  const episodeList: string[] = episodeDetail?.[mode] ?? [];

  // Sort episodes numerically
  const sortedEpisodes = episodeList.sort(
    (a: string, b: string) => parseFloat(a) - parseFloat(b)
  );
  const seriesGroup = getSeriesGroupInfo(
    extractBaseName(show.name ?? ""),
    show.name ?? ""
  );
  const displayName = ["naruto", "naruto shippuden", "naruto extras", "boruto"].includes(
    seriesGroup.key
  )
    ? seriesGroup.displayName
    : show.name;
  const episodeDetails = await getEpisodeDetails(showId, sortedEpisodes, mode).catch(
    () => []
  );

  return {
    id: show._id,
    name: displayName,
    thumbnail: resolveImageUrl(show.thumbnail),
    banner: undefined,
    description: show.description,
    status: show.status,
    episodeCount: show.availableEpisodes?.[mode] ?? 0,
    genres: show.genres ?? [],
    rating: undefined,
    episodes: sortedEpisodes,
    episodeDetails,
  };
}

/**
 * Extract the base series name from an anime title.
 * Strips season markers, subtitles, and ordinals.
 */
export function extractBaseName(name: string): string {
  return name
    // Remove subtitle after colon (require space after to preserve "Re:Zero", "Tokyo Ghoul:re")
    .replace(/[:：]\s+.*/i, "")
    .replace(/\s+[-–—]\s+.*/i, "")
    // Remove trailing dash with nothing after it (e.g. "Burichi -" → "Burichi")
    .replace(/\s+[-–—]\s*$/i, "")
    // Remove season/part markers
    .replace(/\s*(Season|Part|Cour)\s*\d+.*/i, "")
    .replace(/\s*(2nd|3rd|4th|5th|6th)\s*Season.*/i, "")
    .replace(/\s*\d+(st|nd|rd|th)\s*Season.*/i, "")
    .replace(/\s*II+\s*$/i, "")
    // Remove movie/recap/special/OVA/etc. markers (word boundary to avoid matching inside words)
    .replace(/\s+(?:the\s+)?Movie\b.*/i, "")
    .replace(/\s+Recap\b.*/i, "")
    .replace(/\s+Specials?\b.*/i, "")
    .replace(/\s+\bOVA\b.*/i, "")
    .replace(/\s+\bOAD\b.*/i, "")
    .replace(/\s+Rewrite\b.*/i, "")
    .replace(/\s+Pilot\b.*/i, "")
    .replace(/\s+Gaiden\b.*/i, "")
    // Remove trailing "vs." phrases (e.g. "Blue Lock vs. U-20 Japan")
    .replace(/\s+vs\.?\s+.*/i, "")
    // Remove trailing "Re:" or "Re" (recap/remake marker)
    .replace(/\s+Re:?\s*$/i, "")
    // Remove √A / √B style suffixes (Tokyo Ghoul √A)
    .replace(/\s*√.*$/i, "")
    // Remove "TO THE TOP" and similar all-caps subtitles
    .replace(/\s+TO THE TOP\b.*/i, "")
    // Remove Extended Edition, Petit, Mini Anime, Picture Drama
    .replace(/\s+Extended\s+Edition.*/i, "")
    .replace(/\s+Petit$/i, "")
    .replace(/\s+Mini\s+Anime.*/i, "")
    .replace(/\s+Picture\s+Drama.*/i, "")
    .replace(/\s+Ningyou\s+Anime.*/i, "")
    // Remove trailing bare season numbers (e.g. "Steins;Gate 0", "Psycho-Pass 2")
    .replace(/\s+\d+\s*$/, "")
    // Remove "(TV)" or "(ONA)" tags
    .replace(/\s*\((?:TV|ONA|OVA|CAMRIP)\)\s*$/i, "")
    // Remove "[...]" bracket suffixes (require space before to preserve "[Oshi no Ko]")
    .replace(/\s+\[.*\].*$/i, "")
    // Remove "After Story" suffix
    .replace(/\s+After Story\b.*/i, "")
    // Remove "Alternative" suffix (e.g. "Sword Art Online Alternative")
    .replace(/\s+Alternative\b.*/i, "")
    .trim();
}

/**
 * Find related seasons for an anime by searching for its base name.
 * Returns seasons sorted by best guess of order.
 */
export async function findRelatedSeasons(
  showName: string,
  mode: "sub" | "dub" = "sub"
): Promise<SeasonInfo[]> {
  const baseName = extractBaseName(showName);
  if (baseName.length < 3) return [];

  const familyGroup = getSeriesGroupInfo(baseName, showName).key;
  if (["naruto", "naruto shippuden", "boruto", "naruto extras"].includes(familyGroup)) {
    const narutoTerms = ["NARUTO -ナルト-", "Naruto Shippuden", "Boruto", "Road of Naruto"];
    const narutoResults = await Promise.all(
      narutoTerms.map((term) => searchAnime(term, mode, 1, 40))
    );

    const narutoOrder: Record<string, number> = {
      "naruto extras": 1,
      "naruto shippuden": 2,
      naruto: 3,
      boruto: 4,
    };
    const grouped = new Map<string, SeasonInfo>();

    for (const result of narutoResults.flat()) {
      const group = getSeriesGroupInfo(extractBaseName(result.name), result.name);
      if (!(group.key in narutoOrder)) continue;

      const existing = grouped.get(group.key);
      if (!existing || result.episodeCount > existing.episodeCount) {
        grouped.set(group.key, {
          id: result.id,
          name: group.displayName,
          episodeCount: result.episodeCount,
          order: narutoOrder[group.key],
        });
      }
    }

    return Array.from(grouped.values()).sort((a, b) => a.order - b.order);
  }

  const results = await searchAnime(baseName, mode);

  // Filter to results whose base name matches, exclude recaps/specials
  const related = results.filter((r) => {
    const rBase = extractBaseName(r.name);
    const nameLC = r.name.toLowerCase();
    if (nameLC.includes("recap") || nameLC.includes("special") || nameLC.includes("ova")) return false;
    return rBase.toLowerCase() === baseName.toLowerCase() && r.episodeCount > 0;
  });

  if (related.length <= 1) return [];

  // Sort by season order — extract season number from name
  const withOrder = related.map((r) => {
    let order = 0;
    const nameLC = r.name.toLowerCase();
    const seasonMatch = nameLC.match(/(?:season|part|cour)\s*(\d+)/);
    const ordinalMatch = nameLC.match(/(2nd|3rd|4th|5th|6th)\s*season/);
    const romanMatch = nameLC.match(/\s(ii+)\s*$/);

    if (seasonMatch) {
      order = parseInt(seasonMatch[1]);
    } else if (ordinalMatch) {
      const map: Record<string, number> = { "2nd": 2, "3rd": 3, "4th": 4, "5th": 5, "6th": 6 };
      order = map[ordinalMatch[1]] ?? 1;
    } else if (romanMatch) {
      order = romanMatch[1].length; // "ii" = 2, "iii" = 3
    }
    // If no season marker detected, it's likely S1 if plain name, or a sequel/movie if it has a subtitle
    if (order === 0) {
      const hasSubtitle = r.name.includes(":") || r.name.includes(" - ");
      order = hasSubtitle ? 999 : 1; // plain name = S1, subtitle = sort last
    }

    return { id: r.id, name: r.name, episodeCount: r.episodeCount, order };
  });

  withOrder.sort((a, b) => a.order - b.order);
  return withOrder;
}

// Substitution cipher used by AllAnime to obfuscate source URLs (extracted from ani-cli)
const DECODE_TABLE: Record<string, string> = {
  "79": "A", "7a": "B", "7b": "C", "7c": "D", "7d": "E", "7e": "F", "7f": "G",
  "70": "H", "71": "I", "72": "J", "73": "K", "74": "L", "75": "M", "76": "N", "77": "O",
  "68": "P", "69": "Q", "6a": "R", "6b": "S", "6c": "T", "6d": "U", "6e": "V", "6f": "W",
  "60": "X", "61": "Y", "62": "Z",
  "59": "a", "5a": "b", "5b": "c", "5c": "d", "5d": "e", "5e": "f", "5f": "g",
  "50": "h", "51": "i", "52": "j", "53": "k", "54": "l", "55": "m", "56": "n", "57": "o",
  "48": "p", "49": "q", "4a": "r", "4b": "s", "4c": "t", "4d": "u", "4e": "v", "4f": "w",
  "40": "x", "41": "y", "42": "z",
  "08": "0", "09": "1", "0a": "2", "0b": "3", "0c": "4", "0d": "5", "0e": "6", "0f": "7",
  "00": "8", "01": "9",
  "15": "-", "16": ".", "67": "_", "46": "~",
  "02": ":", "17": "/", "07": "?", "1b": "#",
  "63": "[", "65": "]", "78": "@",
  "19": "!", "1c": "$", "1e": "&",
  "10": "(", "11": ")", "12": "*", "13": "+", "14": ",",
  "03": ";", "05": "=", "1d": "%",
};

function decodeSourceUrl(encoded: string): string {
  let decoded = "";
  for (let i = 0; i < encoded.length; i += 2) {
    const pair = encoded.substring(i, i + 2).toLowerCase();
    decoded += DECODE_TABLE[pair] ?? "";
  }
  return decoded.replace("/clock", "/clock.json");
}

/**
 * Get stream URLs for a specific episode.
 * This is the equivalent of ani-cli's get_episode_url + get_links.
 */
export async function getEpisodeStreams(
  showId: string,
  episodeString: string,
  mode: "sub" | "dub" = "sub"
): Promise<StreamLink[]> {
  const data = await gqlRequest(EPISODE_EMBED_GQL, {
    showId,
    translationType: mode,
    episodeString,
  });

  const sourceUrls = data?.data?.episode?.sourceUrls ?? [];
  const links: StreamLink[] = [];

  // Process sources in parallel like ani-cli does (4 providers)
  const promises = sourceUrls.map(async (source: any) => {
    try {
      const rawUrl: string = source.sourceUrl ?? "";
      const sourceName: string = source.sourceName ?? "unknown";

      if (!rawUrl.startsWith("--")) return []; // Skip non-encoded URLs (external embeds)

      // Decode the obfuscated URL using the substitution cipher
      const decoded = decodeSourceUrl(rawUrl.slice(2));
      if (!decoded) return [];

      return await resolveProviderLinks(decoded, sourceName);
    } catch {
      return [];
    }
  });

  const results = await Promise.all(promises);
  for (const result of results) {
    links.push(...result);
  }

  return links;
}

/**
 * Resolve actual video URLs from a provider embed URL.
 * Mirrors ani-cli's get_links() function.
 */
async function resolveProviderLinks(
  decodedUrl: string,
  sourceName: string
): Promise<StreamLink[]> {
  const links: StreamLink[] = [];

  try {
    // If the decoded URL is a direct video URL (tools.fast4speed.rsvp), return it directly
    if (decodedUrl.includes("tools.fast4speed.rsvp")) {
      links.push({
        quality: "auto",
        url: decodedUrl,
        type: "mp4",
        referer: ALLANIME_REFR,
      });
      return links;
    }

    // Otherwise fetch from allanime.day + decoded path
    const fetchUrl = decodedUrl.startsWith("http")
      ? decodedUrl
      : `https://${ALLANIME_BASE}${decodedUrl}`;

    const res = await fetch(fetchUrl, {
      headers: {
        "User-Agent": AGENT,
        Referer: ALLANIME_REFR,
      },
    });
    const text = await res.text();

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      // Not JSON — try regex extraction for raw m3u8/mp4 links
      const m3u8Match = text.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/g);
      if (m3u8Match) {
        for (const url of m3u8Match) {
          links.push({ quality: "auto", url, type: "m3u8", referer: ALLANIME_REFR });
        }
      }
      const mp4Match = text.match(/(https?:\/\/[^\s"']+\.mp4[^\s"']*)/g);
      if (mp4Match) {
        for (const url of mp4Match) {
          links.push({ quality: "auto", url, type: "mp4" });
        }
      }
      return links;
    }

    // Parse structured JSON response (like ani-cli's get_links)
    if (data?.links) {
      for (const link of data.links) {
        const url = link.link ?? link.src ?? link.url ?? "";
        if (!url) continue;
        const resolution = link.resolutionStr ?? link.quality ?? "auto";

        if (url.includes(".m3u8") || link.hls) {
          const referer = data.headers?.Referer ?? data.headers?.referer ?? ALLANIME_REFR;
          try {
            const m3u8Res = await fetch(url, {
              headers: { "User-Agent": AGENT, Referer: referer },
            });
            const m3u8Text = await m3u8Res.text();
            if (m3u8Text.includes("#EXTM3U") && m3u8Text.includes("#EXT-X-STREAM-INF")) {
              // Multi-quality master playlist — extract variants
              const relativeBase = url.replace(/[^/]*$/, "");
              const lines = m3u8Text.split("\n");
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
                  const resMatch = lines[i].match(/RESOLUTION=\d+x(\d+)/);
                  const quality = resMatch ? `${resMatch[1]}p` : "auto";
                  const streamUrl = lines[i + 1]?.trim();
                  if (streamUrl) {
                    const fullUrl = streamUrl.startsWith("http")
                      ? streamUrl
                      : `${relativeBase}${streamUrl}`;
                    links.push({ quality, url: fullUrl, type: "m3u8", referer });
                  }
                }
              }
            }
            // Always include the master playlist itself
            links.push({ quality: resolution, url, type: "m3u8", referer });
          } catch {
            links.push({ quality: resolution, url, type: "m3u8", referer: ALLANIME_REFR });
          }

          // Extract subtitles if present
          if (data.links) {
            const sub = text.match(/"subtitles":\[.*?"lang":"en".*?"src":"([^"]*)"/);
            if (sub?.[1] && links.length > 0) {
              links[0].subtitleUrl = sub[1];
            }
          }
        } else if (url.includes("repackager.wixmp.com")) {
          // WixMP — extract multi-quality mp4 links
          const baseUrl = url.replace(/repackager\.wixmp\.com\//, "").replace(/\.urlset.*/, "");
          const qualitiesMatch = url.match(/\/,([^/]*),\/mp4/);
          if (qualitiesMatch) {
            for (const q of qualitiesMatch[1].split(",")) {
              links.push({
                quality: q,
                url: baseUrl.replace(/,[^/]*/, q),
                type: "mp4",
              });
            }
          } else {
            links.push({ quality: resolution, url, type: "mp4" });
          }
        } else if (url.includes("sharepoint.com")) {
          links.push({ quality: resolution, url, type: "mp4" });
        } else if (url) {
          links.push({
            quality: resolution,
            url,
            type: url.includes(".m3u8") ? "m3u8" : "mp4",
          });
        }
      }
    }
  } catch (err) {
    console.error(`Failed to resolve provider ${sourceName}:`, err);
  }

  return links;
}

/**
 * Get just the best stream URL (convenience function for quick playback)
 */
export async function getBestStreamUrl(
  showId: string,
  episodeString: string,
  preferredQuality: string = "1080p",
  mode: "sub" | "dub" = "sub"
): Promise<StreamLink | null> {
  const streams = await getEpisodeStreams(showId, episodeString, mode);
  if (streams.length === 0) return null;

  // Prefer mp4 for compatibility, then try quality match
  const mp4s = streams.filter((s) => s.type === "mp4");
  const m3u8s = streams.filter((s) => s.type === "m3u8");

  const pool = mp4s.length > 0 ? mp4s : m3u8s;

  // Try to find preferred quality
  const preferred = pool.find((s) => s.quality === preferredQuality);
  if (preferred) return preferred;

  // Fall back: best available (highest resolution)
  const qualityOrder = ["1080p", "720p", "480p", "360p", "auto"];
  for (const q of qualityOrder) {
    const match = pool.find((s) => s.quality === q);
    if (match) return match;
  }

  return pool[0] ?? streams[0] ?? null;
}
