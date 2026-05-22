import Link from "next/link";
import { ShieldCheck, LogOut } from "lucide-react";
import { ClientTopNav } from "@/components/client/ClientTopNav";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/client" className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 border border-primary/25">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="leading-tight">
              <p className="text-xs font-semibold text-foreground leading-none">CamSecure</p>
              <p className="text-[10px] text-c-violet leading-none mt-0.5">Client Portal</p>
            </div>
          </Link>

          <ClientTopNav />

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-medium text-foreground leading-none">Metro Security Ltd</p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">David Park</p>
            </div>
            <Link href="/" aria-label="Sign out" className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded">
              <LogOut className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        {children}
      </main>

      <footer className="border-t border-border py-4 text-center">
        <p className="text-[10px] text-muted-foreground">© 2026 JSG CamSecure. All rights reserved.</p>
      </footer>
    </div>
  );
}
