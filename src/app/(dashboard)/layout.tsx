import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { ProfileProvider } from "@/components/providers/ProfileProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

const ADMIN_ROLES = new Set(["admin", "owner", "dispatcher"]);

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile || !ADMIN_ROLES.has(profile.role)) {
    redirect("/login/admin");
  }

  return (
    <ProfileProvider profile={profile}>
      <div className="flex min-h-screen bg-background">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <main className="flex-1 lg:pl-60 min-w-0 pb-16 lg:pb-0">
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </ProfileProvider>
  );
}
