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

export interface Profile {
  id: number;
  name: string;
  avatar: string;
  pin: string | null;
  createdAt: string;
}

export interface WatchHistoryItem {
  id: number;
  profileId: number;
  animeId: string;
  animeName: string;
  animeImage?: string;
  episodeImage?: string;
  episodeNumber: string;
  episodeTitle?: string;
  episodeDescription?: string;
  progress: number;
  duration: number;
  updatedAt: string;
  seriesName?: string;
  seasonNumber?: number;
}

export interface DownloadItem {
  id: number;
  animeId: string;
  animeName: string;
  episodeNumber: string;
  filePath: string;
  fileSize: number | null;
  status: "pending" | "downloading" | "complete" | "error";
  errorMessage?: string | null;
  createdAt: string;
}

export type DeviceDownloadStatus =
  | "pending"
  | "downloading"
  | "complete"
  | "error"
  | "deleting";

export interface DeviceDownloadItem {
  id: string;
  animeId: string;
  animeName: string;
  animeImage?: string;
  episodeNumber: string;
  episodeTitle?: string;
  episodeImage?: string;
  episodeDescription?: string;
  status: DeviceDownloadStatus;
  progress: number;
  fileSize?: number | null;
  mimeType?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface SkipTime {
  type: "op" | "ed" | "mixed-op" | "mixed-ed" | "recap";
  startTime: number;
  endTime: number;
  episodeLength: number;
}

export interface CachedAnime {
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

export interface BrowseAnimeResponse {
  items: CachedAnime[];
  page: number;
  hasMore: boolean;
  totalAvailable: number;
}

export interface WatchlistItem {
  id: number;
  profileId: number;
  animeId: string;
  animeName: string;
  animeImage?: string | null;
  addedAt: string;
}
