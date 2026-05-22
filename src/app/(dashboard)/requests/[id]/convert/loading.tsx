import { SkeletonTopBar, SkeletonCards } from "@/components/shared/SkeletonPage";
export default function Loading() {
  return (
    <div>
      <SkeletonTopBar />
      <div className="px-6 py-6 max-w-2xl space-y-4">
        <SkeletonCards count={3} />
      </div>
    </div>
  );
}
