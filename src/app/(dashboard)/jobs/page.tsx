import { getJobs } from "@/lib/data/jobs";
import { TopBar } from "@/components/layout/TopBar";
import { JobBoard } from "@/components/jobs/JobBoard";

export default async function JobBoardPage() {
  const jobs = await getJobs();

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Job Board" subtitle={`${jobs.length} jobs`} />
      <JobBoard jobs={jobs} />
    </div>
  );
}
