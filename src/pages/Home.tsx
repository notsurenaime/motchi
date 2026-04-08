import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import HeroBanner from "@/components/HeroBanner";
import AnimeRow from "@/components/AnimeRow";
import { SkeletonHero, SkeletonRow } from "@/components/SkeletonCard";
import type { CachedAnime } from "@/lib/types";

interface HomeProps {
  profileId: number;
}

export default function Home({ profileId }: HomeProps) {
  const [heroIndex, setHeroIndex] = useState(0);

  const { data: trending = [], isLoading: trendingLoading } = useQuery({
    queryKey: ["trending"],
    queryFn: api.getTrending,
  });

  const { data: continueWatching = [] } = useQuery({
    queryKey: ["continue-watching", profileId],
    queryFn: () => api.getContinueWatching(profileId),
  });

  const heroItems = trending.slice(0, 5);
  const heroAnime = heroItems[heroIndex] ?? trending[0];

  useEffect(() => {
    setHeroIndex(0);
  }, [heroItems.length]);

  useEffect(() => {
    if (heroItems.length <= 1) return;

    const interval = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroItems.length);
    }, 7000);

    return () => window.clearInterval(interval);
  }, [heroItems.length]);

  return (
    <div className="space-y-2">
      {/* Hero banner */}
      {trendingLoading ? (
        <SkeletonHero />
      ) : heroAnime ? (
        <HeroBanner
          anime={heroAnime}
          items={heroItems}
          activeIndex={heroIndex}
          onSelect={setHeroIndex}
        />
      ) : (
        <div className="h-[40vh] flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-black tracking-[0.18em] text-rose-400">
              MOTCHI
            </h1>
            <p className="text-zinc-400">
              Search for anime to get started. Metadata will load as you
              explore.
            </p>
          </div>
        </div>
      )}

      {/* Continue Watching */}
      {continueWatching.length > 0 && (
        <AnimeRow
          title="Continue Watching"
          items={continueWatching.map((h) => ({
            id: h.animeId,
            name: h.seriesName ?? h.animeName,
            image: h.animeImage,
            subtitle: `S${h.seasonNumber ?? 1} E${h.episodeNumber} · ${Math.floor(
              (h.progress / h.duration) * 100
            )}%`,
          }))}
        />
      )}

      {/* Trending */}
      {trendingLoading ? (
        <SkeletonRow />
      ) : (
        <AnimeRow
          title="Trending"
          items={trending.map((a) => ({
            id: a.id,
            name: a.name,
            image: a.imageUrl,
            episodeCount: a.episodeCount,
            rating: a.rating,
          }))}
        />
      )}

      {/* By genre */}
      {!trendingLoading && trending.length > 0 && (
        <>
          <GenreRow title="Action" genre="Action" trending={trending} />
          <GenreRow title="Romance" genre="Romance" trending={trending} />
          <GenreRow title="Fantasy" genre="Fantasy" trending={trending} />
          <GenreRow title="Comedy" genre="Comedy" trending={trending} />
        </>
      )}
    </div>
  );
}

function GenreRow({
  title,
  genre,
  trending,
}: {
  title: string;
  genre: string;
  trending: CachedAnime[];
}) {
  const filtered = trending.filter(
    (a) => a.genres && a.genres.includes(genre)
  );
  if (filtered.length === 0) return null;
  return (
    <AnimeRow
      title={title}
      items={filtered.map((a) => ({
        id: a.id,
        name: a.name,
        image: a.imageUrl,
        episodeCount: a.episodeCount,
        rating: a.rating,
      }))}
    />
  );
}
