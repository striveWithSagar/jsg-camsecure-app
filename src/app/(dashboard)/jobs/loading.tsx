import { SkeletonTopBar } from "@/components/shared/SkeletonPage";

export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen">
      <SkeletonTopBar />
      <div className="flex-1 px-6 py-6">
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-[260px] shrink-0 space-y-2.5">
              <div className="h-5 w-24 animate-pulse rounded bg-muted/40" />
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="h-32 animate-pulse rounded-lg border border-border bg-card" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
