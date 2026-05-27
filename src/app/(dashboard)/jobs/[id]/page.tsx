import { notFound } from "next/navigation";
import { getJobById } from "@/lib/data/jobs";
import { getTechnicians } from "@/lib/data/technicians";
import { TopBar } from "@/components/layout/TopBar";
import { JobDetail } from "@/components/jobs/JobDetail";
import { fmtJobNumber } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [job, technicians] = await Promise.all([
    getJobById(id),
    getTechnicians(),
  ]);

  if (!job) notFound();

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title={fmtJobNumber(job.jobNumber)}
        subtitle={`${job.client} · ${job.site}`}
      />
      <div className="flex-1 px-6 py-6 max-w-4xl space-y-6">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Job Board
        </Link>
        <JobDetail job={job} technicians={technicians} />
      </div>
    </div>
  );
}
