"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Overview",    href: "/client" },
  { label: "Jobs",        href: "/client/jobs" },
  { label: "Invoices",    href: "/client/invoices" },
  { label: "New Request", href: "/client/requests/new" },
];

export function ClientTopNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {NAV.map(({ label, href }) => {
        const active = pathname === href || (href !== "/client" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
