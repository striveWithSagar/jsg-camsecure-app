"use client";

import { createContext, useContext } from "react";
import type { ClientProfileData } from "@/lib/data/client-profile";

const FALLBACK: ClientProfileData = {
  name:        "Client",
  email:       "",
  initials:    "C",
  role:        "client",
  companyName: "",
  clientId:    "",
  contactId:   "",
  orgId:       "",
  phone:       "",
};

const ClientProfileContext = createContext<ClientProfileData>(FALLBACK);

export function ClientProfileProvider({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile:  ClientProfileData;
}) {
  return (
    <ClientProfileContext.Provider value={profile}>
      {children}
    </ClientProfileContext.Provider>
  );
}

export function useClientProfile(): ClientProfileData {
  return useContext(ClientProfileContext);
}
