import { SkeletonTopBar, SkeletonTable } from "@/components/shared/SkeletonPage";

export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen">
      <SkeletonTopBar />
      <div className="flex-1 px-6 py-6 space-y-5">
        <div className="flex gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 w-44 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
        <SkeletonTable rows={5} />
      </div>
    </div>
  );
}
