import { TopBar } from "@/components/layout/TopBar";
import { NewRequestForm } from "@/components/requests/NewRequestForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewRequestPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="New Service Request" subtitle="Create a request from a customer call" />
      <div className="flex-1 px-6 py-6 max-w-2xl">
        <Link
          href="/requests"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-3 w-3" /> Back to requests
        </Link>
        <NewRequestForm />
      </div>
    </div>
  );
}
