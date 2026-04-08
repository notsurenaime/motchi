import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Trash2,
  Play,
  CheckCircle,
  Loader2,
  AlertCircle,
  HardDrive,
} from "lucide-react";
import { api } from "@/lib/api";

export default function Downloads() {
  const queryClient = useQueryClient();

  const { data: downloads = [], isLoading } = useQuery({
    queryKey: ["downloads"],
    queryFn: api.getDownloads,
    refetchInterval: 5000, // poll for status updates
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteDownload,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["downloads"] }),
  });

  const retryMutation = useMutation({
    mutationFn: (data: {
      animeId: string;
      animeName: string;
      episodeNumber: string;
    }) => api.startDownload(data.animeId, data.animeName, data.episodeNumber),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["downloads"] }),
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircle size={18} className="text-green-400" />;
      case "downloading":
        return <Loader2 size={18} className="text-blue-400 animate-spin" />;
      case "error":
        return <AlertCircle size={18} className="text-red-400" />;
      default:
        return <Download size={18} className="text-zinc-400" />;
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <HardDrive size={24} className="text-rose-400" />
        <h1 className="text-2xl font-bold text-white">Downloads</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : downloads.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <Download size={48} className="mx-auto text-zinc-700" />
          <p className="text-zinc-500">No downloads yet</p>
          <p className="text-zinc-600 text-sm">
            Download episodes from the anime detail page to watch offline
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {downloads.map((dl) => (
            <div
              key={dl.id}
              className="flex items-center gap-3 sm:gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4 hover:bg-zinc-800/80 transition-colors"
            >
              {statusIcon(dl.status)}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm sm:text-base truncate">
                  {dl.animeName}
                </p>
                <p className="text-zinc-400 text-xs sm:text-sm">
                  Episode {dl.episodeNumber} · {formatSize(dl.fileSize)} ·{" "}
                  <span
                    className={
                      dl.status === "complete"
                        ? "text-green-400"
                        : dl.status === "error"
                        ? "text-red-400"
                        : "text-blue-400"
                    }
                  >
                    {dl.status}
                  </span>
                </p>
                {dl.status === "error" && dl.errorMessage && (
                  <p className="text-red-400/70 text-xs mt-0.5 truncate">
                    {dl.errorMessage}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {dl.status === "error" && (
                  <button
                    onClick={() =>
                      retryMutation.mutate({
                        animeId: dl.animeId,
                        animeName: dl.animeName,
                        episodeNumber: dl.episodeNumber,
                      })
                    }
                    className="text-amber-400 hover:text-amber-300 transition-colors p-2"
                    title="Retry download"
                  >
                    <Download size={18} />
                  </button>
                )}
                {dl.status === "complete" && (
                  <a
                    href={dl.filePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rose-400 hover:text-rose-300 transition-colors p-2"
                    title="Play downloaded file"
                  >
                    <Play size={18} />
                  </a>
                )}
                <button
                  onClick={() => deleteMutation.mutate(dl.id)}
                  className="text-zinc-500 hover:text-red-400 transition-colors p-2"
                  title="Remove from list"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
