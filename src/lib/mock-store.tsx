"use client";

// ─── TEMPORARY MOCK PERSISTENCE ───────────────────────────────────────────────
// This module replaces Supabase while the frontend is being validated.
// TODO: remove this entire file and replace all useMockStore() calls with
//       Supabase queries/mutations once the schema is finalised.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createContext, useContext, useState, useEffect, useRef,
  useCallback, type ReactNode,
} from "react";
import { MOCK_REQUESTS, MOCK_JOBS } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MockRequestItem = {
  id: string;
  client: string;
  phone: string;
  type: string;
  urgency: string;
  status: string;
  created: string;
  description: string;
  notes: string;
};

export type MockJobItem = {
  id: string;
  client: string;
  site: string;
  type: string;
  priority: string;
  status: string;
  technician: string;
  scheduled: string;
  address: string;
};

type MockStore = {
  requests:  MockRequestItem[];
  jobs:      MockJobItem[];
  hydrated:  boolean;
  // TODO: replace each mutation with a Supabase RPC or update call
  updateRequestStatus: (id: string, status: string) => void;
  updateRequestNotes:  (id: string, notes: string) => void;
  convertToJob:        (requestId: string, job: Omit<MockJobItem, "id">) => string;
  updateJobAssignment: (id: string, technician: string, priority: string) => void;
  updateJobStatus:     (id: string, status: string) => void;
};

// ─── localStorage helpers ─────────────────────────────────────────────────────
// TODO: remove when Supabase handles persistence

const STORAGE_KEY = "camsecure_mock_v1";

type PersistedState = { requests: MockRequestItem[]; jobs: MockJobItem[] };

function readStorage(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch { return null; }
}

function writeStorage(s: PersistedState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* quota/private mode */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextJobId(jobs: MockJobItem[]): string {
  const nums = jobs.map(j => parseInt(j.id.replace("JOB-", ""), 10)).filter(n => !isNaN(n));
  const max  = nums.length > 0 ? Math.max(...nums) : 0;
  return `JOB-${String(max + 1).padStart(3, "0")}`;
}

function seedState(): PersistedState {
  return {
    requests: MOCK_REQUESTS.map(r => ({ ...r })),
    jobs:     MOCK_JOBS.map(j => ({ ...j })),
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const Ctx = createContext<MockStore | null>(null);

export function MockStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState]     = useState<PersistedState>(seedState);
  const [hydrated, setHydrated] = useState(false);
  const ref = useRef(state);
  ref.current = state; // always reflects latest state synchronously

  // Hydrate from localStorage after first paint to avoid SSR mismatch
  // TODO: replace with Supabase initial fetch
  useEffect(() => {
    const stored = readStorage();
    if (stored) setState(stored);
    setHydrated(true);
  }, []);

  // Persist on every change after hydration
  // TODO: remove when Supabase mutations handle persistence
  useEffect(() => {
    if (hydrated) writeStorage(state);
  }, [state, hydrated]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const updateRequestStatus = useCallback((id: string, status: string) => {
    setState(p => ({ ...p, requests: p.requests.map(r => r.id === id ? { ...r, status } : r) }));
  }, []);

  const updateRequestNotes = useCallback((id: string, notes: string) => {
    setState(p => ({ ...p, requests: p.requests.map(r => r.id === id ? { ...r, notes } : r) }));
  }, []);

  const convertToJob = useCallback((requestId: string, jobData: Omit<MockJobItem, "id">): string => {
    // Compute ID synchronously from latest state via ref
    const newId = nextJobId(ref.current.jobs);
    const newJob: MockJobItem = { id: newId, ...jobData };
    setState(p => ({
      requests: p.requests.map(r => r.id === requestId ? { ...r, status: "converted" } : r),
      jobs: [...p.jobs, newJob],
    }));
    return newId;
  }, []);

  const updateJobAssignment = useCallback((id: string, technician: string, priority: string) => {
    setState(p => ({ ...p, jobs: p.jobs.map(j => j.id === id ? { ...j, technician, priority } : j) }));
  }, []);

  const updateJobStatus = useCallback((id: string, status: string) => {
    setState(p => ({ ...p, jobs: p.jobs.map(j => j.id === id ? { ...j, status } : j) }));
  }, []);

  return (
    <Ctx.Provider value={{
      requests: state.requests,
      jobs:     state.jobs,
      hydrated,
      updateRequestStatus,
      updateRequestNotes,
      convertToJob,
      updateJobAssignment,
      updateJobStatus,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useMockStore(): MockStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMockStore must be used within MockStoreProvider");
  return ctx;
}
