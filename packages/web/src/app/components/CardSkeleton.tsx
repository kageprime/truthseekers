export function CardSkeleton() {
  return (
    <div className="pixel-card-sm p-0 overflow-hidden animate-pulse bg-white">
      <div className="w-full h-32" style={{ background: "#f1f3f4" }} />
      <div className="p-3 space-y-2">
        <div className="h-5 rounded w-3/4" style={{ background: "#f1f3f4" }} />
        <div className="h-4 rounded w-1/2" style={{ background: "#f1f3f4" }} />
        <div className="h-4 rounded w-full" style={{ background: "#f1f3f4" }} />
        <div className="h-4 rounded w-2/3" style={{ background: "#f1f3f4" }} />
        <div className="flex gap-2 mt-2">
          <div className="h-5 rounded w-14" style={{ background: "#f1f3f4" }} />
          <div className="h-5 rounded w-20" style={{ background: "#f1f3f4" }} />
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
