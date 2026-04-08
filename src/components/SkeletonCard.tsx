export default function SkeletonCard() {
  return (
    <div className="shrink-0 w-[140px] sm:w-[160px] md:w-[180px]">
      <div className="skeleton aspect-[2/3] rounded-lg" />
      <div className="skeleton mt-2 h-4 w-3/4 rounded" />
      <div className="skeleton mt-1 h-3 w-1/2 rounded" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="px-4 sm:px-6">
      <div className="skeleton h-6 w-40 rounded mb-4" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonHero() {
  return (
    <div className="relative h-[56vh] sm:h-[70vh] skeleton">
      <div className="absolute bottom-0 left-0 p-4 sm:p-8 space-y-4">
        <div className="skeleton h-8 sm:h-10 w-64 sm:w-96 rounded" />
        <div className="skeleton h-4 w-56 sm:w-80 rounded" />
        <div className="skeleton h-4 w-48 sm:w-64 rounded" />
        <div className="flex gap-3">
          <div className="skeleton h-10 sm:h-12 w-28 sm:w-32 rounded-lg" />
          <div className="skeleton h-10 sm:h-12 w-28 sm:w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
