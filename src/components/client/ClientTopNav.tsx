"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Overview",    href: "/client" },
  { label: "Jobs",        href: "/client/jobs" },
  { label: "Invoices",    href: "/client/invoices" },
  { label: "Requests",    href: "/client/requests" },
  { label: "New Request", href: "/client/requests/new" },
];

export function ClientTopNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
      {NAV.map(({ label, href }) => {
        const exactMatch = href === "/client" || href === "/client/requests";
        const active = pathname === href || (!exactMatch && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0",
              active
                ? "font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            style={active ? {
              color: "var(--cp-orange-text)",
              background: "var(--cp-orange-dim)",
            } : undefined}
          >
            {label}
            {active && (
              <span
                className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                style={{ background: "var(--cp-orange)" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
