import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Play, Star, ArrowLeft, Heart } from "lucide-react";
import { api } from "@/lib/api";
import { useDownloads } from "@/components/DownloadsProvider";
import EpisodeList from "@/components/EpisodeList";
import { formatTextContent } from "@/lib/text";

interface DetailProps {
  profileId: number;
}

export default function Detail({ profileId }: DetailProps) {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"sub" | "dub">("sub");
  const { downloads, startDownload, openDownload } = useDownloads();

  const { data: anime, isLoading } = useQuery({
    queryKey: ["anime-detail", id, mode],
    queryFn: () => api.getAnimeDetail(id!, mode),
    enabled: !!id,
  });

  const { data: seasons = [] } = useQuery({
    queryKey: ["seasons", id, mode],
    queryFn: () => api.getSeasons(id!, mode),
    enabled: !!id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["history", profileId],
    queryFn: () => api.getHistory(profileId),
  });

  const { data: watchlistStatus } = useQuery({
    queryKey: ["watchlist-status", profileId, id],
    queryFn: () => api.isInWatchlist(profileId, id!),
    enabled: !!id && profileId > 0,
  });

  const toggleWatchlist = useMutation({
    mutationFn: async () => {
      if (watchlistStatus?.inWatchlist) {
        await api.removeFromWatchlist(profileId, id!);
      } else {
        await api.addToWatchlist(profileId, id!, anime?.name ?? "", anime?.thumbnail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist-status", profileId, id] });
      queryClient.invalidateQueries({ queryKey: ["watchlist", profileId] });
    },
  });

  const episodeDetailsByEpisode = useMemo(
    () =>
      new Map(
        (anime?.episodeDetails ?? []).map((episodeDetail) => [
          episodeDetail.episode,
          episodeDetail,
        ])
      ),
    [anime?.episodeDetails]
  );

  const episodeDownloads = useMemo(
    () =>
      Object.fromEntries(
        downloads
          .filter((download) => download.animeId === anime?.id)
          .map((download) => [download.episodeNumber, download])
      ),
    [anime?.id, downloads]
  );

  const handleDownload = async (episode: string) => {
    if (!anime) return;
    try {
      const episodeDetail = episodeDetailsByEpisode.get(episode);
      await startDownload({
        animeId: anime.id,
        animeName: anime.name,
        animeImage: anime.thumbnail,
        episodeNumber: episode,
        episodeTitle: episodeDetail?.title,
        episodeImage: episodeDetail?.image,
        episodeDescription: episodeDetail?.description,
      });
    } catch (err: any) {
      console.error("Download failed:", err.message);
    }
  };

  const handleOpenDownload = async (episode: string) => {
    const download = episodeDownloads[episode];
    if (!download) {
      return;
    }

    try {
      await openDownload(download.id);
    } catch (error) {
      console.error("Failed to open local download", error);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="skeleton h-[40vh] rounded-xl" />
        <div className="skeleton h-8 w-64 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-4 w-3/4 rounded" />
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-zinc-500">
        Anime not found
      </div>
    );
  }

  const animeHistory = history.filter((entry) => entry.animeId === anime.id);
  const description = formatTextContent(anime.description);
  const lastWatched = animeHistory.reduce<(typeof animeHistory)[number] | undefined>(
    (latest, entry) => {
      if (!latest) {
        return entry;
      }

      return new Date(entry.updatedAt).getTime() > new Date(latest.updatedAt).getTime()
        ? entry
        : latest;
    },
    undefined
  );
  const resumeEpisode = lastWatched?.episodeNumber ?? anime.episodes[0];
  const episodeProgress = Object.fromEntries(
    animeHistory.map((entry) => [
      entry.episodeNumber,
      entry.duration > 0
        ? Math.max(0, Math.min(100, (entry.progress / entry.duration) * 100))
        : 0,
    ])
  );

  return (
    <div>
      {/* Banner */}
      <div className="relative h-[30vh] sm:h-[40vh] min-h-[200px] sm:min-h-[300px] overflow-hidden">
        {anime.banner || anime.thumbnail ? (
          <img
            src={anime.banner || anime.thumbnail}
            alt={anime.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-zinc-900" />
        )}
        <div className="hero-gradient absolute inset-0" />
        <div className="hero-gradient-bottom absolute inset-0" />

        <div className="absolute top-4 left-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-zinc-300 hover:text-white transition-colors bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5 text-sm"
          >
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 -mt-20 sm:-mt-32 relative z-10 space-y-6 sm:space-y-8 pb-12">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-8">
          {/* Poster */}
          <div className="shrink-0 flex justify-center md:justify-start">
            {anime.thumbnail ? (
              <img
                src={anime.thumbnail}
                alt={anime.name}
                className="w-32 h-48 sm:w-48 sm:h-72 object-cover rounded-xl shadow-2xl"
              />
            ) : (
              <div className="w-32 h-48 sm:w-48 sm:h-72 bg-zinc-800 rounded-xl" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white">
              {anime.name}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              {anime.rating && (
                <span className="flex items-center gap-1 text-yellow-400 font-bold">
                  <Star size={16} fill="currentColor" />
                  {anime.rating.toFixed(1)}
                </span>
              )}
              <span className="text-zinc-400">
                {anime.episodeCount} Episodes
              </span>
              {anime.status && (
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-medium ${
                    anime.status === "Ongoing"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-zinc-700 text-zinc-300"
                  }`}
                >
                  {anime.status}
                </span>
              )}
            </div>

            {anime.genres && anime.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {anime.genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {description && (
              <p className="text-zinc-300 text-sm leading-relaxed max-w-3xl">
                {description}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {resumeEpisode && (
                <Link
                  to={`/watch/${anime.id}/${resumeEpisode}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-500 px-5 sm:px-8 py-2.5 sm:py-3 text-sm sm:text-base font-bold text-white transition-colors"
                >
                  <Play size={18} fill="white" />
                  <span className="hidden sm:inline">{lastWatched ? "Continue Watching" : "Start Watching"} · </span>
                  <span className="sm:hidden">{lastWatched ? "Continue" : "Watch"} </span>
                  Ep {resumeEpisode}
                </Link>
              )}
              <button
                onClick={() => toggleWatchlist.mutate()}
                disabled={toggleWatchlist.isPending}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 sm:py-3 text-sm font-medium transition-colors ${
                  watchlistStatus?.inWatchlist
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30"
                    : "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700"
                }`}
              >
                <Heart size={16} fill={watchlistStatus?.inWatchlist ? "currentColor" : "none"} />
                {watchlistStatus?.inWatchlist ? "In Watchlist" : "Add to Watchlist"}
              </button>

              {/* Sub/Dub toggle */}
              <div className="flex rounded-lg overflow-hidden border border-zinc-700">
                <button
                  onClick={() => setMode("sub")}
                  className={`px-3 py-2 text-xs font-semibold transition-colors ${
                    mode === "sub"
                      ? "bg-rose-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  SUB
                </button>
                <button
                  onClick={() => setMode("dub")}
                  className={`px-3 py-2 text-xs font-semibold transition-colors ${
                    mode === "dub"
                      ? "bg-rose-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  DUB
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Seasons */}
        {seasons.length > 1 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white">Seasons</h2>
            <div className="flex flex-wrap gap-2">
              {seasons.map((s) => (
                <Link
                  key={s.id}
                  to={`/anime/${s.id}`}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    s.id === anime.id
                      ? "bg-rose-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {s.name} ({s.episodeCount} ep)
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Episodes */}
        {anime.episodes.length > 0 && (
          <EpisodeList
            animeId={anime.id}
            animeName={anime.name}
            episodes={anime.episodes}
            episodeDetails={anime.episodeDetails}
            episodeDownloads={episodeDownloads}
            currentEpisode={lastWatched?.episodeNumber}
            episodeProgress={episodeProgress}
            onDownload={handleDownload}
            onOpenDownload={handleOpenDownload}
          />
        )}
      </div>
    </div>
  );
}
