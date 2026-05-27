import { notFound } from "next/navigation";
import { getJobById } from "@/lib/data/jobs";
import { TechJobDetail } from "@/components/technician/TechJobDetail";

export default async function TechJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJobById(id);

  if (!job) notFound();

  return (
    <div className="space-y-5">
      <TechJobDetail job={job} />
    </div>
  );
}
