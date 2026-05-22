import { notFound } from "next/navigation";
import { MOCK_REQUESTS } from "@/lib/constants";
import { TopBar } from "@/components/layout/TopBar";
import { ConvertJobForm } from "@/components/requests/ConvertJobForm";

export default async function ConvertRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const req = MOCK_REQUESTS.find(r => r.id === id);
  if (!req) notFound();

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Convert to Job" subtitle={`${req.client} · ${req.type}`} />
      <div className="flex-1 px-6 py-6 max-w-2xl">
        <ConvertJobForm request={req} />
      </div>
    </div>
  );
}
