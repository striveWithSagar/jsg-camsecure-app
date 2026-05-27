import type { Metadata } from "next";
import { getDashboardData } from "@/lib/data/dashboard";
import { DashboardView } from "./DashboardView";

export const metadata: Metadata = { title: "Dashboard · CamSecure" };

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <DashboardView data={data} />;
}
