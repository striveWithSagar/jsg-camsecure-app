"use client";

import { Plus, Menu } from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { GlobalSearch } from "./GlobalSearch";
import { useProfile } from "@/components/providers/ProfileProvider";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const profile = useProfile();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/95 backdrop-blur-sm px-6">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "lg:hidden shrink-0")}>
          <Menu className="h-4 w-4" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-60 bg-sidebar border-sidebar-border">
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Title */}
      <div className="min-w-0">
        <h1 className="text-sm font-semibold text-foreground leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      {/* Search */}
      <GlobalSearch />

      <div className="ml-auto flex items-center gap-2">
        {/* Quick add */}
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(buttonVariants({ size: "sm" }), "gap-1.5 h-8 text-xs hidden sm:flex")}>
            <Plus className="h-3.5 w-3.5" />
            New
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem>
              <Link href="/requests/new" className="w-full">New Request</Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link href="/clients" className="w-full">Add Client</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <NotificationBell />

        {/* User */}
        <Avatar className="h-7 w-7 cursor-pointer">
          <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-semibold">{profile.initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
