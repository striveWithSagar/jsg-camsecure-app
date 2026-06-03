import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Business timezone used for all date-label logic (Today/Tomorrow/This Week).
 * Using a constant rather than a DB setting keeps it simple; update here if the
 * company relocates.
 */
export const BUSINESS_TZ = "America/Winnipeg";

/**
 * Returns a YYYY-MM-DD date string in the business timezone.
 * Use this everywhere a "today" key is needed — never use
 * `new Date().toISOString().slice(0, 10)` which gives a UTC date.
 *
 * en-CA locale formats natively as YYYY-MM-DD.
 */
export function businessDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year:  "numeric",
    month: "2-digit",
    day:   "2-digit",
  }).format(date);
}

export function fmtJobNumber(n: number | null | undefined): string {
  return n != null ? `JOB-${String(n).padStart(4, "0")}` : "—";
}

export function fmtReqNumber(n: number | null | undefined): string {
  return n != null ? `REQ-${String(n).padStart(4, "0")}` : "—";
}

export function fmtDatetime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
}

export function calcJobAge(
  createdAt: string,
  completedAt: string | null,
  status: string,
): { label: string; days: number; isComplete: boolean } {
  const created   = new Date(createdAt);
  const isTerminal = status === "completed" || status === "cancelled";
  const end       = isTerminal && completedAt ? new Date(completedAt) : new Date();
  const days      = Math.max(0, Math.round((end.getTime() - created.getTime()) / 86_400_000));
  if (status === "completed") {
    return { label: `Completed in ${days} day${days === 1 ? "" : "s"}`, days, isComplete: true };
  }
  return { label: `Open for ${days} day${days === 1 ? "" : "s"}`, days, isComplete: false };
}
