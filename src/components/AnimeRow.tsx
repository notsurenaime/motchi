import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AnimeCard from "./AnimeCard";

interface AnimeRowProps {
  title: string;
  items: {
    id: string;
    name: string;
    image?: string;
    episodeCount?: number;
    rating?: number;
    subtitle?: string;
  }[];
}

export default function AnimeRow({ title, items }: AnimeRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (items.length === 0) return null;

  return (
    <div className="relative group/row py-4">
      <h2 className="px-4 sm:px-6 mb-3 text-lg font-bold text-white">
        {title}
      </h2>
      <div className="relative">
        {/* Scroll buttons */}
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
          {items.map((item) => (
            <AnimeCard key={item.id} {...item} />
          ))}
        </div>
      </div>
    </div>
  );
}
