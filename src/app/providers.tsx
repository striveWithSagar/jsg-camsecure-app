"use client";

// TODO: replace MockStoreProvider with Supabase session/auth provider once auth is integrated
import { MockStoreProvider } from "@/lib/mock-store";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return <MockStoreProvider>{children}</MockStoreProvider>;
}
