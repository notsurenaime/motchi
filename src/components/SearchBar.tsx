import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api";
import type { AnimeSearchResult } from "@/lib/types";

export default function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnimeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSearch = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.searchAnime(value.trim());
        setResults(data.slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const selectAnime = (id: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    navigate(`/anime/${id}`);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-zinc-400 hover:text-white transition-colors"
      >
        <Search size={20} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-zinc-950/80 backdrop-blur-sm">
      <div className="mx-auto max-w-2xl pt-14 sm:pt-20 px-3 sm:px-4">
        <div className="relative">
          <Search
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search anime..."
            className="w-full rounded-xl bg-zinc-900 border border-zinc-700 py-3 sm:py-4 px-12 text-white text-base sm:text-lg placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
          />
          <button
            onClick={() => {
              setOpen(false);
              setQuery("");
              setResults([]);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Results */}
        <div className="mt-2 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
          {loading && (
            <div className="p-4 text-zinc-400 text-sm">Searching...</div>
          )}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="p-4 text-zinc-500 text-sm">No results found</div>
          )}
          {results.map((anime) => (
            <button
              key={anime.id}
              onClick={() => selectAnime(anime.id)}
              className="flex items-center gap-4 w-full p-3 hover:bg-zinc-800 transition-colors text-left"
            >
              {anime.thumbnail ? (
                <img
                  src={anime.thumbnail}
                  alt={anime.name}
                  className="w-12 h-16 object-cover rounded-md bg-zinc-800"
                  loading="lazy"
                />
              ) : (
                <div className="w-12 h-16 rounded-md bg-zinc-800" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{anime.name}</p>
                <p className="text-zinc-400 text-sm">
                  {anime.episodeCount} episodes
                  {anime.status && ` · ${anime.status}`}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
