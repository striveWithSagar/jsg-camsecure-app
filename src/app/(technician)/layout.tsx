import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TechBottomNav } from "@/components/technician/TechBottomNav";

export default function TechnicianLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/95 backdrop-blur-sm flex items-center gap-3 px-4">
        <Link href="/technician" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 border border-primary/25">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="leading-tight">
            <p className="text-xs font-semibold text-foreground leading-none">CamSecure</p>
            <p className="text-[10px] text-c-teal leading-none mt-0.5">Technician Portal</p>
          </div>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-foreground leading-none">Alex Rivera</p>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">On Job</p>
          </div>
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-semibold">AR</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Main content — max-w for tablet/desktop, full-width on mobile */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-5 pb-20">
        {children}
      </main>

      <TechBottomNav />
    </div>
  );
}
