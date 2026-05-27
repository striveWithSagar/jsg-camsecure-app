"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Inbox, KanbanSquare, Users, HardHat,
  Receipt, Settings, ShieldCheck, LogOut, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/components/providers/ProfileProvider";

const NAV = [
  { label: "Dashboard",        href: "/dashboard",    icon: LayoutDashboard },
  { label: "Service Requests", href: "/requests",     icon: Inbox },
  { label: "Job Board",        href: "/jobs",         icon: KanbanSquare },
  { label: "Clients",          href: "/clients",      icon: Users },
  { label: "Technicians",      href: "/technicians",  icon: HardHat },
  { label: "Invoices",         href: "/invoices",     icon: Receipt },
];

const BOTTOM_NAV = [
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useProfile();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login/admin");
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 border border-primary/25">
          <ShieldCheck className="h-4 w-4 text-primary" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">CamSecure</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Operations</p>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/12 text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="h-3 w-3 text-primary/60" />}
            </Link>
          );
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Bottom */}
      <div className="px-3 py-3 space-y-0.5">
        {BOTTOM_NAV.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/12 text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </div>

      {/* User */}
      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">{profile.initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 leading-tight">
            <p className="text-xs font-medium text-foreground truncate">{profile.name}</p>
            <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
          </div>
          <button aria-label="Sign out" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
