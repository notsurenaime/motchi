import { Link } from "react-router-dom";
import { Play, Info } from "lucide-react";
import type { CachedAnime } from "@/lib/types";

interface HeroBannerProps {
  anime: CachedAnime;
  items?: CachedAnime[];
  activeIndex?: number;
  onSelect?: (index: number) => void;
}

export default function HeroBanner({
  anime,
  items = [],
  activeIndex = 0,
  onSelect,
}: HeroBannerProps) {
  const bgImage = anime.bannerUrl || anime.imageUrl;

  return (
    <div className="relative h-[56vh] sm:h-[70vh] min-h-[350px] sm:min-h-[500px] overflow-hidden animate-fade-in">
      {/* Background image */}
      {bgImage && (
        <img
          src={bgImage}
          alt={anime.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Gradients */}
      <div className="hero-gradient absolute inset-0" />
      <div className="hero-gradient-bottom absolute inset-0" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-10 max-w-3xl space-y-2 sm:space-y-4">
        <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-white leading-tight">
          {anime.name}
        </h1>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-zinc-300">
          {anime.rating && (
            <span className="flex items-center gap-1 text-yellow-400 font-bold">
              ★ {anime.rating.toFixed(1)}
            </span>
          )}
          {anime.episodeCount && (
            <span>{anime.episodeCount} Episodes</span>
          )}
          {anime.status && (
            <span className="rounded-full bg-zinc-800 px-3 py-0.5 text-xs font-medium">
              {anime.status}
            </span>
          )}
          {anime.genres?.slice(0, 3).map((g) => (
            <span
              key={g}
              className="hidden sm:inline rounded-full bg-zinc-800/80 px-2.5 py-0.5 text-xs"
            >
              {g}
            </span>
          ))}
        </div>

        {anime.description && (
          <p className="text-zinc-300 text-xs sm:text-sm md:text-base line-clamp-2 sm:line-clamp-3 max-w-2xl">
            {anime.description.replace(/<[^>]*>/g, "").slice(0, 300)}
          </p>
        )}

        <div className="flex gap-2 sm:gap-3 pt-1 sm:pt-2">
          <Link
            to={`/anime/${anime.id}`}
            className="flex items-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-500 px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-bold text-white transition-colors"
          >
            <Play size={18} fill="white" />
            Watch Now
          </Link>
          <Link
            to={`/anime/${anime.id}`}
            className="flex items-center gap-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-medium text-white transition-colors"
          >
            <Info size={18} />
            Details
          </Link>
        </div>

        {items.length > 1 && onSelect && (
          <div className="flex items-center gap-2 pt-3">
            {items.map((item, index) => (
              <button
                key={item.id}
                onClick={() => onSelect(index)}
                className={`h-2.5 rounded-full transition-all ${
                  index === activeIndex
                    ? "w-8 bg-rose-400"
                    : "w-2.5 bg-white/35 hover:bg-white/55"
                }`}
                aria-label={`Show ${item.name}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
