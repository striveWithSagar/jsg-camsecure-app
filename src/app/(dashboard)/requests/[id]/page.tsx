import { notFound } from "next/navigation";
import { MOCK_REQUESTS } from "@/lib/constants";
import { TopBar } from "@/components/layout/TopBar";
import { RequestDetail } from "@/components/requests/RequestDetail";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const req = MOCK_REQUESTS.find(r => r.id === id);
  if (!req) notFound();

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title={`Request ${req.id}`} subtitle={`${req.client} · ${req.type}`} />
      <div className="flex-1 px-6 py-6 max-w-4xl">
        <Link
          href="/requests"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Requests
        </Link>
        <RequestDetail request={req} />
      </div>
    </div>
  );
}
