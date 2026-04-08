/**
 * AniSkip API Service
 * Fetches OP/ED skip timestamps from the AniSkip API.
 * Falls back gracefully if timestamps aren't available.
 */

const ANISKIP_API = "https://api.aniskip.com/v2";

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
    const params = new URLSearchParams({
      types: JSON.stringify(["op", "ed", "mixed-op", "mixed-ed", "recap"]),
    });
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

    return data.results.map((r: any) => ({
      type: r.skipType,
      startTime: r.interval.startTime,
      endTime: r.interval.endTime,
      episodeLength: r.episodeLength,
    }));
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
    const res = await fetch(
      `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`,
      { headers: { "User-Agent": "Motchi/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0]?.mal_id ?? null;
  } catch {
    return null;
  }
}
