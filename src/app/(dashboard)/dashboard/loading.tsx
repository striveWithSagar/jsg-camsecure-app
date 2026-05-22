import { SkeletonTopBar, SkeletonMetrics, SkeletonTable } from "@/components/shared/SkeletonPage";

export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen">
      <SkeletonTopBar />
      <div className="flex-1 px-6 py-6 space-y-6">
        <SkeletonMetrics />
        <SkeletonMetrics />
        <SkeletonTable rows={4} />
      </div>
    </div>
  );
}
