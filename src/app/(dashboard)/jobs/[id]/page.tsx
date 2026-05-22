import { TopBar } from "@/components/layout/TopBar";
import { JobDetail } from "@/components/jobs/JobDetail";
import { MOCK_JOBS } from "@/lib/constants";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // TODO: replace with Supabase query: supabase.from("jobs").select("*").eq("id", id).single()
  // seedJob is null for converted jobs not yet in constants; JobDetail reads them from the store
  const seedJob = MOCK_JOBS.find(j => j.id === id) ?? null;

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title={`Job ${id}`}
        subtitle={seedJob ? `${seedJob.client} · ${seedJob.site}` : ""}
      />
      <div className="flex-1 px-6 py-6 max-w-4xl space-y-6">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Job Board
        </Link>
        <JobDetail jobId={id} seedJob={seedJob} />
      </div>
    </div>
  );
}