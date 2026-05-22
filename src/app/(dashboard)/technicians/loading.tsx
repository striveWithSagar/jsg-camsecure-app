import { SkeletonTopBar, SkeletonCards } from "@/components/shared/SkeletonPage";

export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen">
      <SkeletonTopBar />
      <div className="flex-1 px-6 py-6 space-y-5">
        <div className="h-8 w-32 animate-pulse rounded bg-muted/40" />
        <SkeletonCards count={5} />
      </div>
    </div>
  );
}
