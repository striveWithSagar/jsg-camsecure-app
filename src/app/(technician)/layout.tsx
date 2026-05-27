import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { ProfileProvider } from "@/components/providers/ProfileProvider";
import { TechHeader } from "@/components/technician/TechHeader";
import { TechBottomNav } from "@/components/technician/TechBottomNav";

export default async function TechnicianLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile || profile.role !== "technician") {
    redirect("/login/technician");
  }

  return (
    <ProfileProvider profile={profile}>
      <div className="min-h-screen bg-background flex flex-col">
        <TechHeader />
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-5 pb-20">
          {children}
        </main>
        <TechBottomNav />
      </div>
    </ProfileProvider>
  );
}
