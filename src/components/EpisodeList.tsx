import { Link } from "react-router-dom";
import { Play, Download } from "lucide-react";

interface EpisodeListProps {
  animeId: string;
  animeName: string;
  episodes: string[];
  currentEpisode?: string;
  episodeProgress?: Record<string, number>;
  onDownload?: (episode: string) => void;
}

export default function EpisodeList({
  animeId,
  animeName,
  episodes,
  currentEpisode,
  episodeProgress,
  onDownload,
}: EpisodeListProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-bold text-white mb-4">
        Episodes ({episodes.length})
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {episodes.map((ep) => (
          <div
            key={ep}
            className={`relative overflow-hidden rounded-lg border p-3 transition-colors ${
              currentEpisode === ep
                ? "border-rose-500 bg-rose-500/10"
                : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-700"
            }`}
          >
            <div
              className="absolute inset-y-0 left-0 bg-rose-500/15 pointer-events-none"
              style={{ width: `${episodeProgress?.[ep] ?? 0}%` }}
            />
            <Link
              to={`/watch/${animeId}/${ep}`}
              className="relative z-10 flex items-center gap-3 flex-1 min-w-0"
            >
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                <Play size={14} className="text-white ml-0.5" fill="white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">
                  Episode {ep}
                </p>
                <p className="text-xs text-zinc-500">{animeName}</p>
              </div>
            </Link>
            {onDownload && (
              <button
                onClick={() => onDownload(ep)}
                className="relative z-10 text-zinc-500 hover:text-rose-400 transition-colors p-1"
                title="Download episode"
              >
                <Download size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
