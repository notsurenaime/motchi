import type {
  AnimeSearchResult,
  AnimeDetail,
  StreamLink,
  Profile,
  WatchHistoryItem,
  DownloadItem,
  CachedAnime,
  SkipTime,
  SeasonInfo,
  BrowseAnimeResponse,
} from "./types";

const API_ORIGIN = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_SERVER_PORT ?? "3001"}`
  : "";

const BASE = `${API_ORIGIN}/api`;
const DEFAULT_TIMEOUT_MS = 20000;

export function getApiUrl(path: string) {
  return `${BASE}${path}`;
}

interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
}

function mergeAbortSignals(
  signal: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

async function apiFetch<T>(url: string, options?: ApiRequestOptions): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...requestInit } = options ?? {};
  const merged = mergeAbortSignals(signal ?? undefined, timeoutMs);

  try {
    const res = await fetch(getApiUrl(url), {
      ...requestInit,
      signal: merged.signal,
      headers: { "Content-Type": "application/json", ...requestInit.headers },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `API error: ${res.status}`);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return res.json();
    }

    return (await res.text()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    merged.cleanup();
  }
}

// Anime
export const api = {
  searchAnime: (q: string, mode: "sub" | "dub" = "sub") =>
    apiFetch<AnimeSearchResult[]>(
      `/anime/search?q=${encodeURIComponent(q)}&mode=${mode}`
    ),

  getTrending: () => apiFetch<CachedAnime[]>("/anime/trending"),

  browseAnime: (
    genre?: string,
    status?: string,
    page = 1,
    limit = 36
  ) => {
    const params = new URLSearchParams();
    if (genre) params.set("genre", genre);
    if (status) params.set("status", status);
    params.set("page", String(page));
    params.set("limit", String(limit));
    return apiFetch<BrowseAnimeResponse>(`/anime/browse?${params}`);
  },

  getAnimeDetail: (id: string, mode: "sub" | "dub" = "sub") =>
    apiFetch<AnimeDetail>(`/anime/${id}?mode=${mode}`),

  getEpisodeStreams: (
    animeId: string,
    episode: string,
    mode: "sub" | "dub" = "sub"
  ) =>
    apiFetch<StreamLink[]>(
      `/anime/${animeId}/episode/${episode}/streams?mode=${mode}`,
      { timeoutMs: 45000 }
    ),

  getPlayUrl: (
    animeId: string,
    episode: string,
    quality?: string,
    mode?: string
  ) => {
    const params = new URLSearchParams();
    if (quality) params.set("quality", quality);
    if (mode) params.set("mode", mode);
    return apiFetch<StreamLink>(
      `/anime/${animeId}/episode/${episode}/play?${params}`,
      { timeoutMs: 45000 }
    );
  },

  // Profiles
  getProfiles: () => apiFetch<Profile[]>("/profiles"),

  createProfile: (name: string, avatar?: string, pin?: string) =>
    apiFetch<Profile>("/profiles", {
      method: "POST",
      body: JSON.stringify({ name, avatar, pin }),
    }),

  verifyPin: (profileId: number, pin: string) =>
    apiFetch<{ verified: boolean }>(`/profiles/${profileId}/verify`, {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),

  deleteProfile: (profileId: number) =>
    apiFetch<{ deleted: boolean }>(`/profiles/${profileId}`, {
      method: "DELETE",
    }),

  // History
  getHistory: (profileId: number) =>
    apiFetch<WatchHistoryItem[]>(`/profiles/${profileId}/history`),

  getContinueWatching: (profileId: number) =>
    apiFetch<WatchHistoryItem[]>(`/profiles/${profileId}/continue-watching`),

  updateProgress: (data: {
    profileId: number;
    animeId: string;
    animeName: string;
    animeImage?: string;
    episodeNumber: string;
    progress: number;
    duration: number;
  }) =>
    apiFetch<WatchHistoryItem>("/history", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Downloads
  getDownloads: () => apiFetch<DownloadItem[]>("/downloads"),

  startDownload: (animeId: string, animeName: string, episodeNumber: string) =>
    apiFetch<DownloadItem>("/downloads", {
      method: "POST",
      body: JSON.stringify({ animeId, animeName, episodeNumber }),
    }),

  deleteDownload: (id: number) =>
    apiFetch<{ deleted: boolean }>(`/downloads/${id}`, { method: "DELETE" }),

  // Skip times
  getSkipTimes: (title: string, episode: string, duration?: number) => {
    const params = new URLSearchParams({ title, episode });
    if (duration) params.set("duration", String(duration));
    return apiFetch<{ skipTimes: SkipTime[]; malId: number | null }>(
      `/skip-times?${params}`,
      { timeoutMs: 10000 }
    );
  },

  // Seasons
  getSeasons: (animeId: string, mode: "sub" | "dub" = "sub") =>
    apiFetch<SeasonInfo[]>(`/anime/${animeId}/seasons?mode=${mode}`),

  // Watchlist
  getWatchlist: (profileId: number) =>
    apiFetch<import("./types").WatchlistItem[]>(`/profiles/${profileId}/watchlist`),

  addToWatchlist: (profileId: number, animeId: string, animeName: string, animeImage?: string) =>
    apiFetch<import("./types").WatchlistItem>(`/profiles/${profileId}/watchlist`, {
      method: "POST",
      body: JSON.stringify({ animeId, animeName, animeImage }),
    }),

  removeFromWatchlist: (profileId: number, animeId: string) =>
    apiFetch<{ deleted: boolean }>(`/profiles/${profileId}/watchlist/${animeId}`, {
      method: "DELETE",
    }),

  isInWatchlist: (profileId: number, animeId: string) =>
    apiFetch<{ inWatchlist: boolean }>(`/profiles/${profileId}/watchlist/${animeId}`),
};
