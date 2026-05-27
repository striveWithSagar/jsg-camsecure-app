"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/components/providers/ProfileProvider";

export function TechHeader() {
  const profile = useProfile();
  const router  = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login/technician");
  }

  return (
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
          <p className="text-xs font-medium text-foreground leading-none">{profile.name}</p>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Field Technician</p>
        </div>
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-semibold">{profile.initials}</AvatarFallback>
        </Avatar>
        <button
          aria-label="Sign out"
          onClick={handleSignOut}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
