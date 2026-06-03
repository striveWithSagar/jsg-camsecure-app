"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { useClientProfile } from "@/components/providers/ClientProfileProvider";
import { ClientTopNav } from "@/components/client/ClientTopNav";

export function ClientHeader() {
  const profile = useClientProfile();
  const router  = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login/client");
  }

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm"
      style={{ borderBottom: "1px solid var(--cp-orange-border)" }}
    >
      {/* Orange accent bar at very top */}
      <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, var(--cp-orange) 0%, var(--cp-cyan) 100%)" }} />

      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <Link href="/client" className="shrink-0 flex items-center">
          <Image
            src="/brand/jsg-camsecure-logo.png"
            alt="JSG CamSecure"
            width={110}
            height={36}
            className="object-contain h-8 w-auto"
            priority
          />
        </Link>

        {/* Nav */}
        <ClientTopNav />

        {/* User area */}
        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-semibold text-foreground leading-none">{profile.companyName}</p>
            <p className="text-[10px] leading-none mt-0.5" style={{ color: "var(--cp-cyan-text)" }}>
              {profile.name}
            </p>
          </div>
          <Avatar className="h-7 w-7">
            <AvatarFallback
              className="text-[10px] font-bold"
              style={{
                background: "var(--cp-orange-dim)",
                color: "var(--cp-orange-text)",
              }}
            >
              {profile.initials}
            </AvatarFallback>
          </Avatar>
          <button
            aria-label="Sign out"
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
