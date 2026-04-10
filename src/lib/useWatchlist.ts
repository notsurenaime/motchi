import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { WatchlistItem } from "./types";

interface ToggleWatchlistInput {
  animeId: string;
  animeName: string;
  animeImage?: string;
}

interface ToggleWatchlistMutationInput extends ToggleWatchlistInput {
  action: "add" | "remove";
}

export function useWatchlist(profileId: number) {
  const queryClient = useQueryClient();
  const queryKey = ["watchlist", profileId] as const;

  const watchlistQuery = useQuery({
    queryKey,
    queryFn: () => api.getWatchlist(profileId),
    enabled: profileId > 0,
  });

  const toggleMutation = useMutation({
    mutationFn: async (input: ToggleWatchlistMutationInput) => {
      if (input.action === "remove") {
        await api.removeFromWatchlist(profileId, input.animeId);
        return { animeId: input.animeId, action: "remove" as const };
      }

      await api.addToWatchlist(profileId, input.animeId, input.animeName, input.animeImage);
      return { animeId: input.animeId, action: "add" as const };
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });

      const previousWatchlist = queryClient.getQueryData<WatchlistItem[]>(queryKey) ?? [];

      if (input.action === "remove") {
        queryClient.setQueryData<WatchlistItem[]>(
          queryKey,
          previousWatchlist.filter((item) => item.animeId !== input.animeId)
        );
      } else {
        queryClient.setQueryData<WatchlistItem[]>(queryKey, [
          {
            id: -Date.now(),
            profileId,
            animeId: input.animeId,
            animeName: input.animeName,
            animeImage: input.animeImage ?? null,
            addedAt: new Date().toISOString(),
          },
          ...previousWatchlist,
        ]);
      }

      return { previousWatchlist, animeId: input.animeId };
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      queryClient.setQueryData(queryKey, context.previousWatchlist);
    },
    onSettled: (_data, _error, _input, context) => {
      queryClient.invalidateQueries({ queryKey });
      if (context?.animeId) {
        queryClient.invalidateQueries({ queryKey: ["watchlist-status", profileId, context.animeId] });
      }
    },
  });

  const watchlist = watchlistQuery.data ?? [];
  const watchlistIds = useMemo(
    () => new Set(watchlist.map((item) => item.animeId)),
    [watchlist]
  );

  return {
    watchlist,
    watchlistIds,
    isLoading: watchlistQuery.isLoading,
    toggleWatchlist: (input: ToggleWatchlistInput) => {
      if (!input.animeId) {
        return;
      }

      toggleMutation.mutate({
        ...input,
        action: watchlistIds.has(input.animeId) ? "remove" : "add",
      });
    },
    isToggling: toggleMutation.isPending,
  };
}