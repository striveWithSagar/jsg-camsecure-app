"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", href: "/technician",      icon: LayoutDashboard },
  { label: "My Jobs",   href: "/technician/jobs", icon: Briefcase },
];

export function TechBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex h-16 items-stretch border-t border-sidebar-border bg-sidebar">
      {NAV.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || (href !== "/technician" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
