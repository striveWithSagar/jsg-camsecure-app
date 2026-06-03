import { getJobBoardData } from "@/lib/data/jobs";
import { TopBar } from "@/components/layout/TopBar";
import { JobBoard } from "@/components/jobs/JobBoard";
import { businessDateKey } from "@/lib/utils";

function makeBoardSubtitle(bucket: Awaited<ReturnType<typeof getJobBoardData>>): string {
  if (bucket.isWeekView) {
    const total = bucket.weekDays.reduce((s, d) => s + d.jobs.length, 0);
    const extra = bucket.overdue.length > 0 ? ` · ${bucket.overdue.length} overdue` : "";
    return `This Week · ${total} scheduled${extra}`;
  }
  const d = new Date(bucket.selectedDate + "T12:00:00Z");
  const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const parts: string[] = [];
  if (bucket.active.length > 0)  parts.push(`${bucket.active.length} active`);
  if (bucket.overdue.length > 0) parts.push(`${bucket.overdue.length} overdue`);
  return parts.length > 0 ? `${label} · ${parts.join(" · ")}` : label;
}

export default async function JobBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const dateParam = date ?? businessDateKey();

  const bucket = await getJobBoardData(dateParam);

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Job Board" subtitle={makeBoardSubtitle(bucket)} />
      <JobBoard bucket={bucket} dateParam={dateParam} />
    </div>
  );
}
