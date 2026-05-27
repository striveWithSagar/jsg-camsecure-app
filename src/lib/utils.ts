import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtJobNumber(n: number | null | undefined): string {
  return n != null ? `JOB-${String(n).padStart(4, "0")}` : "—";
}

export function fmtReqNumber(n: number | null | undefined): string {
  return n != null ? `REQ-${String(n).padStart(4, "0")}` : "—";
}
