import { useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

interface ContinueWatchingItem {
  animeId: string;
  animeName: string;
  seriesName?: string;
  animeImage?: string;
  episodeImage?: string;
  episodeNumber: string;
  episodeTitle?: string;
  episodeDescription?: string;
  progress: number;
  duration: number;
}

interface ContinueWatchingRowProps {
  title: string;
  items: ContinueWatchingItem[];
}

export default function ContinueWatchingRow({
  title,
  items,
}: ContinueWatchingRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.85;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (items.length === 0) return null;

  return (
    <div className="relative group/row py-4">
      <h2 className="px-4 sm:px-6 mb-3 text-lg font-bold text-white">{title}</h2>
      <div className="relative">
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-r from-zinc-950 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-center"
        >
          <ChevronLeft size={24} className="text-white" />
        </button>
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-l from-zinc-950 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-center"
        >
          <ChevronRight size={24} className="text-white" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto px-4 sm:px-6 hide-scrollbar"
        >
          {items.map((item) => {
            const progress =
              item.duration > 0
                ? Math.max(0, Math.min(100, (item.progress / item.duration) * 100))
                : 0;
            const image = item.episodeImage ?? item.animeImage;

            return (
              <article
                key={`${item.animeId}-${item.episodeNumber}`}
                className="group/item relative shrink-0 w-[300px] sm:w-[340px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-700 hover:bg-zinc-800"
              >
                <Link to={`/anime/${item.animeId}`} className="block">
                  <div className="relative aspect-video bg-zinc-800">
                    {image ? (
                      <img
                        src={image}
                        alt={item.episodeTitle || item.seriesName || item.animeName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 text-zinc-500">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Play size={14} className="ml-0.5" fill="currentColor" />
                          Episode {item.episodeNumber}
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">
                        Episode {item.episodeNumber}
                      </p>
                      <p className="line-clamp-2 text-sm font-semibold text-white">
                        {item.episodeTitle || item.seriesName || item.animeName}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 space-y-2">
                    <p className="line-clamp-3 min-h-[3.75rem] text-xs leading-relaxed text-zinc-400">
                      {item.episodeDescription || "Episode details are not available for this entry yet."}
                    </p>
                    <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      <span className="truncate">{item.seriesName || item.animeName}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                  </div>
                </Link>

                <Link
                  to={`/watch/${item.animeId}/${item.episodeNumber}`}
                  aria-label={`Play ${item.seriesName || item.animeName} episode ${item.episodeNumber}`}
                  className="absolute left-1/2 top-[28%] z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-rose-500/90 text-white shadow-lg shadow-black/40 transition-all hover:scale-105 hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 group-hover/item:scale-105"
                >
                  <Play size={24} className="ml-0.5" fill="currentColor" />
                </Link>

                <div className="h-1 bg-zinc-800">
                  <div className="h-full bg-rose-500/70" style={{ width: `${progress}%` }} />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}