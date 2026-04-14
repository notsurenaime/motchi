/**
 * AniSkip API Service
 * Fetches OP/ED skip timestamps from the AniSkip API.
 * Falls back gracefully if timestamps aren't available.
 */

import { extractBaseName } from "./anime-bridge.js";
import {
  extractSeasonNumber,
  getDisplayName,
  getSeriesKey,
} from "./anime-names.js";

const ANISKIP_API = "https://api.aniskip.com/v2";

interface JikanTitle {
  title?: string;
}

interface JikanAnimeResult {
  mal_id?: number;
  title?: string;
  title_english?: string | null;
  title_japanese?: string | null;
  titles?: JikanTitle[];
  type?: string | null;
}

function normalizeTitleForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getCandidateTitles(entry: JikanAnimeResult): string[] {
  return Array.from(
    new Set(
      [
        entry.title,
        entry.title_english,
        entry.title_japanese,
        ...(entry.titles?.map((title) => title.title) ?? []),
      ].filter((value): value is string => Boolean(value?.trim()))
    )
  );
}

function hasExplicitSeasonMarker(value: string): boolean {
  return /(Season\s*:?\s*\d+|\d+(?:st|nd|rd|th)\s+Season|\s(?:VIII|VII|VI|IV|V|III|II)\b|Part\s+\d+|\s\d+$)/i.test(
    value
  );
}

function getSeasonScore(candidateTitle: string, requestedSeason: number): number {
  const candidateSeason = extractSeasonNumber(candidateTitle);
  const candidateHasExplicitSeason = hasExplicitSeasonMarker(candidateTitle);

  if (candidateSeason === requestedSeason) {
    return candidateHasExplicitSeason || requestedSeason > 1 ? 40 : 15;
  }

  if (candidateHasExplicitSeason || requestedSeason > 1) {
    return -120;
  }

  return 0;
}

function scoreCandidate(
  entry: JikanAnimeResult,
  requestedTitle: string,
  expectedKeys: Set<string>,
  expectedTitles: Set<string>
): number {
  let bestScore = 0;
  const normalizedRequestedTitle = normalizeTitleForMatch(requestedTitle);
  const requestedSeason = extractSeasonNumber(requestedTitle);

  for (const candidateTitle of getCandidateTitles(entry)) {
    const normalizedCandidate = normalizeTitleForMatch(candidateTitle);
    const candidateKey = getSeriesKey(extractBaseName(candidateTitle));

    let score = 0;
    if (normalizedCandidate === normalizedRequestedTitle) {
      score += 180;
    } else if (expectedTitles.has(normalizedCandidate)) {
      score += 75;
    }
    if (expectedKeys.has(candidateKey)) {
      score += 80;
    }
    score += getSeasonScore(candidateTitle, requestedSeason);
    for (const expectedTitle of expectedTitles) {
      if (!expectedTitle) continue;
      if (
        normalizedCandidate.startsWith(expectedTitle) ||
        expectedTitle.startsWith(normalizedCandidate)
      ) {
        score += 30;
      }
    }

    bestScore = Math.max(bestScore, score);
  }

  if (entry.type === "TV") {
    bestScore += 5;
  }

  return bestScore;
}

async function searchMalCandidates(query: string): Promise<JikanAnimeResult[]> {
  const res = await fetch(
    `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=10`,
    { headers: { "User-Agent": "Motchi/1.0" } }
  );
  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return Array.isArray(data?.data) ? data.data : [];
}

export interface SkipTime {
  type: "op" | "ed" | "mixed-op" | "mixed-ed" | "recap";
  startTime: number;
  endTime: number;
  episodeLength: number;
}

export async function getSkipTimes(
  malId: number,
  episodeNumber: number,
  episodeLength?: number
): Promise<SkipTime[]> {
  try {
    const params = new URLSearchParams();
    for (const type of ["op", "ed"]) {
      params.append("types", type);
    }
    if (episodeLength) {
      params.set("episodeLength", String(Math.floor(episodeLength)));
    }

    const res = await fetch(
      `${ANISKIP_API}/skip-times/${malId}/${episodeNumber}?${params}`,
      {
        headers: { "User-Agent": "Motchi/1.0" },
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    if (!data?.found || !data?.results) return [];

    const normalizedResults = data.results
      .map((r: any) => ({
        type: r.skipType,
        startTime: r.interval.startTime,
        endTime: r.interval.endTime,
        episodeLength: r.episodeLength,
      }))
      .filter(
        (skip: SkipTime) =>
          (skip.type === "op" || skip.type === "ed") &&
          Number.isFinite(skip.startTime) &&
          Number.isFinite(skip.endTime) &&
          Number.isFinite(skip.episodeLength) &&
          skip.startTime >= 0 &&
          skip.endTime > skip.startTime &&
          skip.endTime - skip.startTime >= 15 &&
          skip.endTime - skip.startTime <= 240
      )
      .sort((left: SkipTime, right: SkipTime) => left.startTime - right.startTime);

    const referenceEpisodeLength =
      typeof episodeLength === "number" && Number.isFinite(episodeLength)
        ? episodeLength
        : normalizedResults[0]?.episodeLength;

    if (
      referenceEpisodeLength &&
      normalizedResults.some(
        (skip: SkipTime) =>
          Math.abs(skip.episodeLength - referenceEpisodeLength) > 120
      )
    ) {
      return [];
    }

    return normalizedResults.filter((skip: SkipTime) => {
      if (!referenceEpisodeLength) {
        return true;
      }

      if (skip.endTime > referenceEpisodeLength) {
        return false;
      }

      if (skip.type === "op") {
        return skip.startTime <= Math.min(600, referenceEpisodeLength * 0.45);
      }

      return (
        skip.startTime >= referenceEpisodeLength * 0.5 &&
        skip.endTime >= referenceEpisodeLength * 0.7
      );
    });
  } catch {
    return [];
  }
}

/**
 * Search MAL (MyAnimeList) for the anime ID needed by AniSkip.
 * Uses Jikan API (unofficial MAL API).
 */
export async function findMalId(title: string): Promise<number | null> {
  try {
    const baseTitle = extractBaseName(title);
    const displayTitle = getDisplayName(baseTitle);
    const queryVariants = Array.from(
      new Set(
        [displayTitle, title, baseTitle].filter(
          (value) => value.trim().length >= 2
        )
      )
    );
    const expectedKeys = new Set(
      queryVariants.map((value) => getSeriesKey(extractBaseName(value)))
    );
    const expectedTitles = new Set(
      queryVariants.map((value) => normalizeTitleForMatch(value))
    );

    let bestMatch: JikanAnimeResult | null = null;
    let bestScore = -1;

    for (const query of queryVariants) {
      const candidates = await searchMalCandidates(query);
      for (const candidate of candidates) {
        const score = scoreCandidate(
          candidate,
          title,
          expectedKeys,
          expectedTitles
        );
        if (score > bestScore) {
          bestScore = score;
          bestMatch = candidate;
        }
      }

      if (bestScore >= 180) {
        break;
      }
    }

    return bestMatch?.mal_id ?? null;
  } catch {
    return null;
  }
}
