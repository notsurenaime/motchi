import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import AnimeCard from "@/components/AnimeCard";
import type { WatchlistItem } from "@/lib/types";

interface WatchlistProps {
  profileId: number;
}

export default function Watchlist({ profileId }: WatchlistProps) {
  const queryClient = useQueryClient();

  const { data: watchlist = [], isLoading } = useQuery({
    queryKey: ["watchlist", profileId],
    queryFn: () => api.getWatchlist(profileId),
    enabled: profileId > 0,
  });

  const removeFromWatchlist = useMutation({
    mutationFn: (animeId: string) => api.removeFromWatchlist(profileId, animeId),
    onMutate: async (animeId) => {
      const queryKey = ["watchlist", profileId] as const;
      await queryClient.cancelQueries({ queryKey });
      const previousWatchlist = queryClient.getQueryData<WatchlistItem[]>(queryKey) ?? [];

      queryClient.setQueryData<WatchlistItem[]>(
        queryKey,
        previousWatchlist.filter((entry) => entry.animeId !== animeId)
      );

      return { previousWatchlist };
    },
    onError: (_error, _animeId, context) => {
      if (!context) return;
      queryClient.setQueryData(["watchlist", profileId], context.previousWatchlist);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist", profileId] });
    },
  });

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 px-5 py-6 sm:px-8 sm:py-8 mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/25 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-300">
              <Heart size={14} className="text-rose-400" />
              Watchlist
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">Saved anime</h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                Keep a clean queue here. Use the heart button on any anime card to add it, and the same control to remove it when you are done.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3 text-sm text-zinc-300">
            {watchlist.length} saved title{watchlist.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[2/3] rounded-lg" />
          ))}
        </div>
      ) : watchlist.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <Heart size={48} className="mx-auto text-zinc-700" />
          <p className="text-zinc-500">Your watchlist is empty</p>
          <p className="text-zinc-600 text-sm">Start adding titles from Home, Browse, or any detail page.</p>
          <Link
            to="/browse"
            className="inline-flex rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-rose-400 hover:text-white"
          >
            Browse anime
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {watchlist.map((item) => (
            <AnimeCard
              key={item.animeId}
              id={item.animeId}
              name={item.animeName}
              image={item.animeImage ?? undefined}
              subtitle="Saved for later"
              isWatchlisted={true}
              onWatchlistToggle={(animeId) => removeFromWatchlist.mutate(animeId)}
              className="w-full"
            />
          ))}
        </div>
      )}
    </div>
  );
}
