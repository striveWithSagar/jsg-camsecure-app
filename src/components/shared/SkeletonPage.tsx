function SkeletonBox({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/40 ${className ?? ""}`} />;
}

export function SkeletonMetrics() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonBox key={i} className="h-20 border border-border" />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <SkeletonBox className="h-10 rounded-none border-b border-border bg-muted/20" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0">
          <SkeletonBox className="h-4 w-20 shrink-0" />
          <SkeletonBox className="h-4 flex-1" />
          <SkeletonBox className="h-5 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBox key={i} className="h-40 border border-border" />
      ))}
    </div>
  );
}

export function SkeletonTopBar() {
  return (
    <div className="h-14 border-b border-border bg-background/95 flex items-center px-6 gap-4">
      <SkeletonBox className="h-5 w-32" />
      <SkeletonBox className="h-8 flex-1 max-w-md hidden sm:block" />
    </div>
  );
}
