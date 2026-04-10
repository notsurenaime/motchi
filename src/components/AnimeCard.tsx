import { Link } from "react-router-dom";
import { Play, Heart } from "lucide-react";

interface AnimeCardProps {
  id: string;
  name: string;
  image?: string;
  episodeCount?: number;
  rating?: number;
  subtitle?: string;
  className?: string;
  isWatchlisted?: boolean;
  onWatchlistToggle?: () => void;
}

export default function AnimeCard({
  id,
  name,
  image,
  episodeCount,
  rating,
  subtitle,
  className,
  isWatchlisted,
  onWatchlistToggle,
}: AnimeCardProps) {
  return (
    <div
      className={`group relative animate-fade-in ${className ?? "shrink-0 w-[140px] sm:w-[160px] md:w-[180px]"}`}
    >
      <div className="relative">
        <Link to={`/anime/${id}`} className="block">
          <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800">
            {image ? (
              <img
                src={image}
                alt={name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                No Image
              </div>
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-rose-500 flex items-center justify-center">
                <Play size={24} className="text-white ml-1" fill="white" />
              </div>
            </div>
            {rating && (
              <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5 text-xs font-bold text-yellow-400">
                ★ {typeof rating === "number" ? rating.toFixed(1) : rating}
              </div>
            )}
          </div>
        </Link>

        {onWatchlistToggle && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onWatchlistToggle();
            }}
            className={`absolute bottom-2 right-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border transition-all opacity-0 group-hover:opacity-100 ${
              isWatchlisted
                ? "border-rose-400/70 bg-rose-500 text-white"
                : "border-zinc-700 bg-black/70 text-zinc-300 hover:border-rose-400 hover:text-rose-300"
            }`}
            title={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Heart size={14} fill={isWatchlisted ? "currentColor" : "none"} />
          </button>
        )}
      </div>

      <Link to={`/anime/${id}`} className="block">
        <h3 className="mt-2 text-sm font-medium text-white truncate group-hover:text-rose-400 transition-colors">
          {name}
        </h3>
        <p className="text-xs text-zinc-500">
          {subtitle || (episodeCount ? `${episodeCount} episodes` : "")}
        </p>
      </Link>
    </div>
  );
}
