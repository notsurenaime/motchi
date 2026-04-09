import { useState, useRef, useEffect } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Compass, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import AnimeCard from "@/components/AnimeCard";
import SkeletonCard from "@/components/SkeletonCard";
import type { AnimeSearchResult, CachedAnime } from "@/lib/types";

function isSearchResult(anime: AnimeSearchResult | CachedAnime): anime is AnimeSearchResult {
  return "thumbnail" in anime;
}

const GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Thriller",
];

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearchQuery = searchParams.get("q") ?? "";
  const initialGenre = searchParams.get("genre") ?? "";
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedGenre, setSelectedGenre] = useState<string>(initialGenre);
  const [debouncedQuery, setDebouncedQuery] = useState(initialSearchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isSearching = debouncedQuery.trim().length >= 2;

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (searchQuery) {
      nextParams.set("q", searchQuery);
    }
    if (selectedGenre) {
      nextParams.set("genre", selectedGenre);
    }

    const currentQuery = searchParams.get("q") ?? "";
    const currentGenre = searchParams.get("genre") ?? "";
    if (currentQuery === searchQuery && currentGenre === selectedGenre) {
      return;
    }

    setSearchParams(nextParams, { replace: true });
  }, [searchParams, searchQuery, selectedGenre, setSearchParams]);

  const getCardImage = (anime: AnimeSearchResult | CachedAnime) => {
    if (isSearchResult(anime)) {
      return anime.thumbnail;
    }
    return anime.imageUrl;
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 400);
  };

  // Search results
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => api.searchAnime(debouncedQuery),
    enabled: isSearching,
  });

  const {
    data: browsePages,
    isLoading: browseLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["browse", selectedGenre],
    queryFn: ({ pageParam }) =>
      api.browseAnime(selectedGenre || undefined, undefined, pageParam, 36),
    initialPageParam: 1,
    enabled: !isSearching,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
  });

  const browseResults = browsePages?.pages.flatMap((page) => page.items) ?? [];
  const totalAvailable = Math.max(
    browsePages?.pages[0]?.totalAvailable ?? 0,
    browseResults.length
  );
  const items = isSearching ? searchResults ?? [] : browseResults;
  const loading = isSearching ? searchLoading : browseLoading;
  const browseSummary = isSearching
    ? `${items.length} result${items.length === 1 ? "" : "s"} for \"${debouncedQuery}\"`
    : `${totalAvailable.toLocaleString()} anime available in the library${selectedGenre ? `, filtered by ${selectedGenre}` : ""}`;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <Compass size={24} className="text-rose-400" />
          <h1 className="text-2xl font-bold text-white">Browse</h1>
        </div>
        <p className="text-sm text-zinc-400">{browseSummary}</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search anime..."
          className="w-full rounded-xl bg-zinc-900 border border-zinc-800 py-3 px-12 text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
        />
      </div>

      {/* Genre filters */}
      {!isSearching && (
        <div className="flex gap-2 mb-8 overflow-x-auto hide-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          <button
            onClick={() => setSelectedGenre("")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              !selectedGenre
                ? "bg-rose-500 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            All
          </button>
          {GENRES.map((genre) => (
            <button
              key={genre}
              onClick={() =>
                setSelectedGenre(selectedGenre === genre ? "" : genre)
              }
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                selectedGenre === genre
                  ? "bg-rose-500 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      )}

      {/* Results grid */}
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
        {loading
          ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
          : items.map((anime) => (
              <AnimeCard
                key={anime.id}
                id={anime.id}
                name={anime.name}
                image={getCardImage(anime)}
                episodeCount={anime.episodeCount}
                rating={"rating" in anime ? anime.rating : undefined}
                className="w-full"
              />
            ))}
      </div>

      {!isSearching && !loading && hasNextPage && (
        <div className="flex justify-center pt-8">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-full border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-rose-400 hover:text-white disabled:cursor-wait disabled:opacity-60"
          >
            {isFetchingNextPage ? "Loading more..." : "Load more anime"}
          </button>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-20 text-zinc-500">
          {isSearching
            ? "No results found. Try a different search."
            : "No anime found for this filter yet."}
        </div>
      )}
    </div>
  );
}
