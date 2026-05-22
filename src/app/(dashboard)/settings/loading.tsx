import { SkeletonTopBar } from "@/components/shared/SkeletonPage";

export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen">
      <SkeletonTopBar />
      <div className="flex-1 px-6 py-6 max-w-2xl space-y-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg border border-border bg-card" />
        ))}
      </div>
    </div>
  );
}
