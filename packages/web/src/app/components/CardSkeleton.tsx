export function CardSkeleton() {
  return (
    <div className="glass-card-static overflow-hidden">
      <div className="w-full aspect-[16/9] skeleton" />
      <div className="p-4 space-y-3">
        <div className="h-4 skeleton w-3/4" />
        <div className="h-3 skeleton w-1/2" />
        <div className="h-3 skeleton w-full" />
        <div className="h-3 skeleton w-2/3" />
        <div className="flex gap-2 pt-1">
          <div className="h-4 skeleton w-14" />
          <div className="h-4 skeleton w-20" />
        </div>
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
