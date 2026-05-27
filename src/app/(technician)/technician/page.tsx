import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/data/profile";
import { getTechJobList } from "@/lib/data/tech-jobs";
import { TechnicianDashboardView } from "./TechnicianDashboardView";

export const metadata: Metadata = { title: "My Dashboard · CamSecure Technician" };

export default async function TechnicianPage() {
  const [profile, jobs] = await Promise.all([
    getCurrentProfile(),
    getTechJobList(),
  ]);

  const firstName = profile?.name.split(" ")[0] ?? "there";

  return <TechnicianDashboardView firstName={firstName} jobs={jobs} />;
}
