import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  HardDrive,
  Loader2,
  Play,
  RotateCw,
  Trash2,
} from "lucide-react";
import { useDownloads } from "@/components/DownloadsProvider";
import { formatTextContent } from "@/lib/text";

function formatSize(bytes?: number | null) {
  if (!bytes) return "0 MB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function Downloads() {
  const { downloads, isReady, startDownload, deleteDownload, openDownload } = useDownloads();

  const groupedDownloads = Object.values(
    downloads.reduce<
      Record<
        string,
        {
          animeId: string;
          animeName: string;
          animeImage?: string;
          episodes: typeof downloads;
        }
      >
    >((groups, item) => {
      const key = item.animeId;
      if (!groups[key]) {
        groups[key] = {
          animeId: item.animeId,
          animeName: item.animeName,
          animeImage: item.animeImage,
          episodes: [],
        };
      }

      groups[key].episodes.push(item);
      return groups;
    }, {})
  ).map((group) => ({
    ...group,
    episodes: [...group.episodes].sort(
      (a, b) => Number(a.episodeNumber) - Number(b.episodeNumber)
    ),
  }));

  const totalSize = downloads.reduce(
    (sum, item) => sum + (item.status === "complete" ? item.fileSize ?? 0 : 0),
    0
  );
  const completedCount = downloads.filter((item) => item.status === "complete").length;
  const activeCount = downloads.filter(
    (item) => item.status === "downloading" || item.status === "pending"
  ).length;

  const renderStatusChip = (status: string) => {
    switch (status) {
      case "complete":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-300">
            <CheckCircle2 size={12} /> Ready offline
          </span>
        );
      case "downloading":
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-1 text-xs font-medium text-sky-300">
            <Loader2 size={12} className="animate-spin" /> Saving to device
          </span>
        );
      case "deleting":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-1 text-xs font-medium text-red-300">
            <Trash2 size={12} /> Removing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-300">
            <AlertCircle size={12} /> Needs retry
          </span>
        );
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <HardDrive size={24} className="text-rose-400" />
          <h1 className="text-2xl font-bold text-white">Downloads</h1>
        </div>
        <p className="max-w-2xl text-sm text-zinc-400">
          {completedCount} ready offline, {activeCount} in progress, {formatSize(totalSize)} stored in this browser on this device.
        </p>
      </div>

      {!isReady ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-64 rounded-xl" />
          ))}
        </div>
      ) : groupedDownloads.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <Download size={48} className="mx-auto text-zinc-700" />
          <p className="text-zinc-500">No local downloads yet</p>
          <p className="text-zinc-600 text-sm">
            Start a download from an anime detail page and it will be saved only on this device.
          </p>
          <Link
            to="/browse"
            className="inline-flex rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-rose-400 hover:text-white"
          >
            Browse anime
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedDownloads.map((group) => {
            const groupSize = group.episodes.reduce(
              (sum, item) => sum + (item.status === "complete" ? item.fileSize ?? 0 : 0),
              0
            );

            return (
              <section
                key={group.animeId}
                className="rounded-xl border border-zinc-800 bg-zinc-900"
              >
                <div className="flex flex-col gap-4 border-b border-zinc-800 p-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                      {group.animeImage ? (
                        <img
                          src={group.animeImage}
                          alt={group.animeName}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-600">
                          <HardDrive size={18} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h2 className="truncate text-lg font-semibold text-white">{group.animeName}</h2>
                      <p className="text-sm text-zinc-400">
                        {group.episodes.length} episodes on this device · {formatSize(groupSize)} stored
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.episodes.map((item) => {
                    const title = formatTextContent(item.episodeTitle);
                    const description = formatTextContent(item.episodeDescription);

                    return (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
                      >
                        <div className="relative aspect-video bg-zinc-800">
                          {item.episodeImage ? (
                            <img
                              src={item.episodeImage}
                              alt={title || `Episode ${item.episodeNumber}`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-zinc-500">
                              Episode {item.episodeNumber}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                          <div className="absolute bottom-3 left-3 right-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-300">
                              Episode {item.episodeNumber}
                            </p>
                            <p className="line-clamp-2 text-sm font-semibold text-white">
                              {title || group.animeName}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            {renderStatusChip(item.status)}
                            <span className="text-xs text-zinc-500">{formatSize(item.fileSize)}</span>
                          </div>

                          <p className="line-clamp-3 min-h-[3.75rem] text-sm leading-relaxed text-zinc-400">
                            {description || "Episode details are not available for this download yet."}
                          </p>

                          {(item.status === "downloading" || item.status === "pending") && (
                            <div className="space-y-2">
                              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                                <div
                                  className="h-full rounded-full bg-sky-400 transition-all"
                                  style={{ width: `${item.progress}%` }}
                                />
                              </div>
                              <p className="text-xs text-sky-300">
                                {item.progress > 0
                                  ? `${item.progress}% downloaded to local browser storage`
                                  : "Preparing local download"}
                              </p>
                            </div>
                          )}

                          {item.status === "error" && item.errorMessage && (
                            <p className="text-xs text-amber-300">{item.errorMessage}</p>
                          )}

                          <div className="flex flex-wrap gap-2 pt-1">
                            {item.status === "complete" && (
                              <button
                                onClick={() => void openDownload(item.id)}
                                className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-500/30"
                              >
                                <Play size={15} /> Open offline
                              </button>
                            )}

                            {item.status === "error" && (
                              <button
                                onClick={() =>
                                  void startDownload({
                                    animeId: item.animeId,
                                    animeName: item.animeName,
                                    animeImage: item.animeImage,
                                    episodeNumber: item.episodeNumber,
                                    episodeTitle: item.episodeTitle,
                                    episodeImage: item.episodeImage,
                                    episodeDescription: item.episodeDescription,
                                  })
                                }
                                className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-200 transition-colors hover:bg-amber-500/30"
                              >
                                <RotateCw size={15} /> Retry
                              </button>
                            )}

                            <button
                              onClick={() => void deleteDownload(item.id)}
                              disabled={item.status === "deleting"}
                              className="inline-flex items-center gap-2 rounded-full bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-red-500/20 hover:text-red-200 disabled:cursor-wait disabled:opacity-60"
                            >
                              <Trash2 size={15} />
                              {item.status === "deleting" ? "Removing" : item.status === "downloading" ? "Cancel" : "Delete"}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
