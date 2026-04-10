import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import AnimeCard from "@/components/AnimeCard";
import { useWatchlist } from "@/lib/useWatchlist";

interface WatchlistProps {
  profileId: number;
}

export default function Watchlist({ profileId }: WatchlistProps) {
  const { watchlist, isLoading, toggleWatchlist } = useWatchlist(profileId);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <Heart size={24} className="text-rose-400" />
          <h1 className="text-2xl font-bold text-white">Watchlist</h1>
        </div>
        <p className="text-sm text-zinc-400">
          {watchlist.length} saved title{watchlist.length === 1 ? "" : "s"} ready to pick up later.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skeleton aspect-[2/3] rounded-lg" />
          ))}
        </div>
      ) : watchlist.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-6 py-12 text-center">
          <Heart size={40} className="mx-auto text-zinc-700" />
          <h2 className="mt-4 text-lg font-semibold text-white">Your watchlist is empty</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Start adding titles from Home, Browse, or any detail page.
          </p>
          <Link
            to="/browse"
            className="mt-5 inline-flex rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
          >
            Browse anime
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {watchlist.map((item) => (
            <AnimeCard
              key={item.animeId}
              id={item.animeId}
              name={item.animeName}
              image={item.animeImage ?? undefined}
              subtitle="Saved for later"
              isWatchlisted={true}
              onWatchlistToggle={() =>
                toggleWatchlist({
                  animeId: item.animeId,
                  animeName: item.animeName,
                  animeImage: item.animeImage ?? undefined,
                })
              }
              className="w-full"
            />
          ))}
        </div>
      )}
    </div>
  );
}
