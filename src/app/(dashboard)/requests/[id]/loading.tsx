import { SkeletonTopBar, SkeletonCards } from "@/components/shared/SkeletonPage";
export default function Loading() {
  return (
    <div>
      <SkeletonTopBar />
      <div className="px-6 py-6 max-w-4xl space-y-4">
        <SkeletonCards count={2} />
      </div>
    </div>
  );
}
