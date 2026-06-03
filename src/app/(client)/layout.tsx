import { redirect } from "next/navigation";
import { getCurrentClientProfile } from "@/lib/data/client-profile";
import { ClientProfileProvider } from "@/components/providers/ClientProfileProvider";
import { ClientHeader } from "@/components/client/ClientHeader";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentClientProfile();

  if (!profile) {
    redirect("/login/client");
  }

  return (
    <ClientProfileProvider profile={profile}>
      {/* cp-portal scopes JSG brand tokens + Inter font to the client portal only */}
      <div className="cp-portal min-h-screen bg-background flex flex-col">
        <ClientHeader />

        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
          {children}
        </main>

        <footer className="border-t border-[var(--cp-orange-border)] py-4 text-center">
          <p className="text-[10px] text-muted-foreground tracking-wide">
            © 2026 JSG CamSecure. All rights reserved.
          </p>
        </footer>
      </div>
    </ClientProfileProvider>
  );
}
