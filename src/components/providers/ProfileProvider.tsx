"use client";

import { createContext, useContext } from "react";
import type { ProfileData } from "@/lib/data/profile";

const FALLBACK: ProfileData = { name: "Admin", email: "", initials: "A", role: "admin" };

const ProfileContext = createContext<ProfileData>(FALLBACK);

export function ProfileProvider({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: ProfileData;
}) {
  return (
    <ProfileContext.Provider value={profile}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileData {
  return useContext(ProfileContext);
}
