import { Link } from "react-router-dom";
import { Play, Download, Loader2, CheckCircle2, RotateCw, Trash2 } from "lucide-react";
import type { DeviceDownloadItem, EpisodeDetail } from "@/lib/types";
import { formatTextContent } from "@/lib/text";

interface EpisodeListProps {
  animeId: string;
  animeName: string;
  episodes: string[];
  episodeDetails?: EpisodeDetail[];
  episodeDownloads?: Record<string, DeviceDownloadItem | undefined>;
  currentEpisode?: string;
  episodeProgress?: Record<string, number>;
  onDownload?: (episode: string) => void;
  onOpenDownload?: (episode: string) => void;
  onDeleteDownload?: (episode: string) => void;
}

export default function EpisodeList({
  animeId,
  animeName,
  episodes,
  episodeDetails = [],
  episodeDownloads = {},
  currentEpisode,
  episodeProgress,
  onDownload,
  onOpenDownload,
  onDeleteDownload,
}: EpisodeListProps) {
  const episodeDetailsByEpisode = new Map(
    episodeDetails.map((episodeDetail) => [episodeDetail.episode, episodeDetail])
  );

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-bold text-white mb-4">
        Episodes ({episodes.length})
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {episodes.map((ep) => {
          const episodeDetail = episodeDetailsByEpisode.get(ep);
          const downloadItem = episodeDownloads[ep];
          const title = formatTextContent(episodeDetail?.title);
          const description = formatTextContent(episodeDetail?.description);

          const renderDownloadButton = () => {
            if (!downloadItem) {
              return (
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDownload?.(ep);
                  }}
                  className="absolute right-2 top-2 z-10 rounded-full bg-black/55 p-2 text-zinc-300 transition-colors hover:text-rose-400"
                  title="Download to this device"
                >
                  <Download size={16} />
                </button>
              );
            }

            if (downloadItem.status === "complete") {
              return (
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenDownload?.(ep);
                  }}
                  className="absolute right-2 top-2 z-10 rounded-full bg-emerald-500/90 p-2 text-white transition-colors hover:bg-emerald-400"
                  title="Open offline download"
                >
                  <CheckCircle2 size={16} />
                </button>
              );
            }

            if (downloadItem.status === "error") {
              return (
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDownload?.(ep);
                  }}
                  className="absolute right-2 top-2 z-10 rounded-full bg-amber-500/90 p-2 text-white transition-colors hover:bg-amber-400"
                  title={downloadItem.errorMessage ?? "Retry download"}
                >
                  <RotateCw size={16} />
                </button>
              );
            }

            if (downloadItem.status === "deleting") {
              return (
                <span className="absolute right-2 top-2 z-10 rounded-full bg-red-500/85 p-2 text-white">
                  <Trash2 size={16} />
                </span>
              );
            }

            return (
              <button
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                disabled
                className="absolute right-2 top-2 z-10 rounded-full bg-sky-500/85 p-2 text-white"
                title={
                  downloadItem.progress > 0
                    ? `Downloading ${downloadItem.progress}%`
                    : "Preparing local download"
                }
              >
                <Loader2 size={16} className="animate-spin" />
              </button>
            );
          };

          return (
            <div
              key={ep}
              className={`relative overflow-hidden rounded-lg border transition-colors ${
                currentEpisode === ep
                  ? "border-rose-500 bg-rose-500/10"
                  : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-700"
              }`}
            >
              <Link
                to={`/watch/${animeId}/${ep}`}
                className="block"
              >
                <div className="relative aspect-video bg-zinc-800">
                  {episodeDetail?.image ? (
                    <img
                      src={episodeDetail.image}
                      alt={title || `Episode ${ep}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 text-zinc-500">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Play size={14} className="ml-0.5" fill="currentColor" />
                        Episode {ep}
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">
                      Episode {ep}
                    </p>
                    <p className="line-clamp-2 text-sm font-semibold text-white">
                      {title || animeName}
                    </p>
                  </div>
                </div>

                  <div className="p-3">
                    <p className="line-clamp-3 min-h-[3.75rem] text-xs leading-relaxed text-zinc-400">
                    {description || "Episode details are not available for this entry yet."}
                  </p>
                </div>
              </Link>

              <div className="absolute bottom-0 left-0 h-1 bg-rose-500/70" style={{ width: `${episodeProgress?.[ep] ?? 0}%` }} />

              {(onDownload || downloadItem) && renderDownloadButton()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
