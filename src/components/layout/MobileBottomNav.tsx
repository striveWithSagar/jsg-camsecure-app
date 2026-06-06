"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Inbox, KanbanSquare, Users,
  MoreHorizontal, HardHat, Receipt, Settings, Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose,
} from "@/components/ui/sheet";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Requests",  href: "/requests",  icon: Inbox },
  { label: "Jobs",      href: "/jobs",      icon: KanbanSquare },
  { label: "Clients",   href: "/clients",   icon: Users },
];

const MORE_NAV = [
  { label: "Technicians",    href: "/technicians",   icon: HardHat },
  { label: "Invoices",       href: "/invoices",      icon: Receipt },
  { label: "Announcements",  href: "/announcements", icon: Megaphone },
  { label: "Settings",       href: "/settings",      icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const moreActive = MORE_NAV.some(item => pathname.startsWith(item.href));

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex h-16 items-stretch border-t border-sidebar-border bg-sidebar lg:hidden">
      {NAV.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
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

      <Sheet>
        <SheetTrigger
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
            moreActive ? "text-primary" : "text-muted-foreground"
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </SheetTrigger>

        <SheetContent side="bottom" className="pb-safe">
          <SheetHeader className="pb-2">
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6 space-y-1">
            {MORE_NAV.map(({ label, href, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <SheetClose
                  key={href}
                  render={
                    <Link
                      href={href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/12 text-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                      )}
                    >
                      <Icon className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "")} />
                      {label}
                    </Link>
                  }
                />
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
