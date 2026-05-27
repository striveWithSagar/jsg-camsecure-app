import type { Metadata } from "next";
import { getCurrentClientProfile } from "@/lib/data/client-profile";
import { getClientJobs, getClientInvoices } from "@/lib/data/client-portal";
import { ClientDashboardView } from "./ClientDashboardView";

export const metadata: Metadata = { title: "Overview · CamSecure Client Portal" };

export default async function ClientPage() {
  const [profile, jobs, invoices] = await Promise.all([
    getCurrentClientProfile(),
    getClientJobs(),
    getClientInvoices(),
  ]);

  return <ClientDashboardView profile={profile} jobs={jobs} invoices={invoices} />;
}
