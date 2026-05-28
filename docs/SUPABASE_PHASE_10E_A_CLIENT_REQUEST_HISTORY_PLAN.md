# Phase 10E-A: Client Request History — Audit & Implementation Plan

**Date:** 2026-05-28  
**Status:** PLAN ONLY — no code changes in this phase  
**Base commit:** 1099426

---

## 1. Audit Findings

### 1.1 Current client portal routes

| Route | File | Status |
|-------|------|--------|
| `/client` | `(client)/client/page.tsx` | ✅ Exists |
| `/client/jobs` | `(client)/client/jobs/page.tsx` | ✅ Exists |
| `/client/invoices` | `(client)/client/invoices/page.tsx` | ✅ Exists |
| `/client/requests/new` | `(client)/client/requests/new/page.tsx` | ✅ Exists |
| `/client/requests` | — | ❌ Missing — needs to be created |

`/client/requests/new/loading.tsx` and `error.tsx` exist. No `loading.tsx` or `error.tsx` exist for `/client/requests`.

---

### 1.2 RLS — `service_requests_select` policy (full text)

```sql
QUAL: (
  (organization_id = auth_org_id() AND auth_role() IN ('owner','admin','dispatcher'))
  OR
  (client_id = auth_client_id() AND auth_role() = 'client')
)
```

**Verdict: No RLS change needed.** Client role sees only rows where `client_id = auth_client_id()`. Walk-in requests where `client_id IS NULL` are invisible to clients — the `NULL = auth_client_id()` comparison always evaluates false in Postgres.

---

### 1.3 DB state — service_requests

| `client_id` | Count | Visibility to client |
|-------------|-------|---------------------|
| NULL (walk-in) | 8 | ❌ Hidden by RLS |
| Metro Security Ltd (`a0000000-...0101`) | 1 | ✅ Visible (REQ-008) |

**Seeded client-linked request:** REQ-008, `service_type=dvr_nvr_issue`, `urgency=medium`, `status=new`, submitted 2026-05-26.

David Park (Metro Security Ltd) will see exactly 1 request on the list page until they submit more.

---

### 1.4 Data layer — what is missing

`src/lib/data/client-portal.ts` exports `getClientJobs()` and `getClientInvoices()` — no `getClientRequests()`. This is the only data helper that needs to be added. Pattern is identical to `getClientJobs()`.

The `ServiceRequest` type in `src/lib/data/service-requests.ts` is the admin type (`select("*")`). The client view needs a lighter `ClientRequestItem` type returning only what the page needs.

The `SERVICE_TYPE_LABELS` map already exists inside `client-portal.ts` (lines 24–35) — it can be reused directly.

`REQUEST_STATUS_LABELS` is already exported from `src/lib/constants.ts`:
```typescript
{
  new:               "New",
  reviewing:         "Reviewing",
  ready_to_schedule: "Ready to Schedule",
  converted:         "Converted to Job",
  cancelled:         "Cancelled",
}
```

---

### 1.5 Navigation — `ClientTopNav.tsx`

Current NAV array:
```typescript
{ label: "Overview",    href: "/client" },
{ label: "Jobs",        href: "/client/jobs" },
{ label: "Invoices",    href: "/client/invoices" },
{ label: "New Request", href: "/client/requests/new" },
```

Missing: a "Requests" link pointing to `/client/requests`.

**Active-state conflict to fix:** The current active condition is:
```typescript
active = pathname === href || (href !== "/client" && pathname.startsWith(href))
```
If "Requests" (`/client/requests`) is added before "New Request" (`/client/requests/new`), then on `/client/requests/new`:
- "Requests" would match via `startsWith` ✅ (correct — user is in the requests section)
- "New Request" would also match via `startsWith` ✅ (correct — user is on this specific page)

Both being highlighted simultaneously is not ideal but acceptable since "New Request" is a sub-page of "Requests". The cleaner fix is to make `/client/requests` use exact match — same treatment `/client` already gets.

**Recommended fix:** extend the exact-match exclusion from just `"/client"` to both root paths:
```typescript
const exactMatchHrefs = new Set(["/client", "/client/requests"]);
active = pathname === href || (!exactMatchHrefs.has(href) && pathname.startsWith(href));
```

This means:
- `/client`: active only when pathname === `/client`
- `/client/requests`: active only when pathname === `/client/requests`
- `/client/requests/new`: active when pathname starts with `/client/requests/new` (exact match, no sub-pages yet)
- `/client/jobs`, `/client/invoices`: active via startsWith (in case sub-routes are added later)

---

### 1.6 `calcJobAge` adaptation for service requests

`calcJobAge(createdAt, completedAt, status)` recognises only `"completed"` and `"cancelled"` as terminal.

Service requests have no `completed_at` column but do have `updated_at`. Terminal request statuses are `"converted"` and `"cancelled"`.

**Mapping for requests:**
```typescript
const terminalStatus = req.status === "converted" ? "completed" : req.status;
const ageInfo = calcJobAge(req.createdAt, req.updatedAt, terminalStatus);
```

Result:
- `new / reviewing / ready_to_schedule` → "Open for X days" (how long since submission)
- `cancelled` → "Completed in X days" (misleading label — see note below)
- `converted` → "Completed in X days" (accurate: request was resolved)

**Note:** "Completed in X days" for a cancelled request is slightly off. The implementation may choose to display the age row only for active requests and skip it (or show just the submission date) for terminal ones. The plan mandates using `calcJobAge`; the exact label wording is a judgment call at implementation time.

---

## 2. Summary — What Already Works vs What Is Missing

| Item | Status |
|------|--------|
| RLS: client sees only own `client_id` requests | ✅ Already enforced |
| RLS: walk-in requests (`client_id = NULL`) hidden | ✅ Already enforced |
| `REQUEST_STATUS_LABELS` in constants | ✅ Exists |
| `SERVICE_TYPE_LABELS` map in `client-portal.ts` | ✅ Exists |
| `fmtReqNumber`, `fmtDatetime`, `calcJobAge` in utils | ✅ Exists |
| `getClientRequests()` data helper | ❌ Missing |
| `ClientRequestItem` type | ❌ Missing |
| `/client/requests` page | ❌ Missing |
| `/client/requests/loading.tsx` | ❌ Missing |
| `/client/requests/error.tsx` | ❌ Missing |
| "Requests" link in `ClientTopNav.tsx` | ❌ Missing |

**Conclusion: No DB migration, no RLS change, no schema change needed. Pure frontend feature — 3 new files, 2 small edits.**

---

## 3. Implementation Plan

### 3.1 Files to create

#### `src/lib/data/client-portal.ts` — ADD `getClientRequests()` (within existing file)

Add a `ClientRequestItem` type and `getClientRequests()` alongside the existing exports.

Type:
```typescript
export type ClientRequestItem = {
  id:          string;
  reqNumber:   number | null;
  serviceType: string;   // display label
  urgency:     string;   // raw enum (emergency|high|medium|low)
  status:      string;   // raw enum
  description: string;
  createdAt:   string;   // raw ISO
  updatedAt:   string;   // raw ISO
};
```

Function:
```typescript
// No client_id filter — RLS enforces client_id = auth_client_id() for role 'client'
export async function getClientRequests(): Promise<ClientRequestItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .select("id, request_number, service_type, urgency, status, description, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getClientRequests]", error.message);
    return [];
  }

  return ((data ?? []) as RawRequestRow[]).map(row => ({
    id:          row.id,
    reqNumber:   row.request_number ?? null,
    serviceType: SERVICE_TYPE_LABELS[row.service_type] ?? row.service_type,
    urgency:     row.urgency,
    status:      row.status,
    description: row.description,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }));
}
```

`RawRequestRow` is a local type (not exported) matching the selected columns.

---

#### `src/app/(client)/client/requests/page.tsx` — CREATE

Server Component (`no "use client"`). Pattern mirrors `client/jobs/page.tsx`.

```typescript
import type { Metadata } from "next";
import { getClientRequests } from "@/lib/data/client-portal";
// imports: fmtReqNumber, fmtDatetime, calcJobAge from utils
// imports: REQUEST_STATUS_LABELS from constants
// imports: StatusBadge (or inline urgency chip)

export const metadata: Metadata = { title: "Your Requests · CamSecure Client Portal" };

export default async function ClientRequestsPage() {
  const requests = await getClientRequests(); // RLS-filtered
  return <RequestsView requests={requests} />;
}
```

Inline `RequestCard` component (no separate file):

```
┌──────────────────────────────────────────────────┐
│ REQ-008                   [New]                  │
│ DVR/NVR Issue · Medium urgency                   │
│ ────────────────────────────────────────────────  │
│ Submitted: May 26, 2026 · 06:02 AM               │
│ Age:       Open for 2 days                        │
│ Description: (truncated to 2 lines)               │
└──────────────────────────────────────────────────┘
```

**Status badge:** reuse `StatusBadge` component from `@/components/shared/StatusBadge` — check whether it covers request statuses. If not (it may only cover job statuses), use a simple inline chip with `REQUEST_STATUS_LABELS`. `StatusBadge` takes a `value` prop; implementation should verify it renders request statuses correctly or fall back to a plain `<span>`.

**Urgency display:** show urgency as a coloured chip (e.g., emergency=red, high=amber, medium=blue, low=gray) inline next to service type. Simple `<span className="...">` — no separate component needed.

**Empty state:**
```tsx
{requests.length === 0 && (
  <p className="text-sm text-muted-foreground py-12 text-center rounded-xl border border-dashed border-border">
    No service requests on record for your account.
  </p>
)}
```

**Sort:** `getClientRequests()` already orders by `created_at DESC` — newest first, no additional sorting needed in the component.

---

#### `src/app/(client)/client/requests/loading.tsx` — CREATE

Match pattern of existing client loading files:
```typescript
import { SkeletonCards } from "@/components/shared/SkeletonPage";
export default function Loading() {
  return <div className="space-y-4 py-2"><SkeletonCards count={3} /></div>;
}
```

---

#### `src/app/(client)/client/requests/error.tsx` — CREATE

Match pattern of existing client error files (read one to confirm exact pattern before implementing).

---

### 3.2 Files to modify

#### `src/components/client/ClientTopNav.tsx`

**Change 1:** Add "Requests" to the NAV array before "New Request":
```typescript
const NAV = [
  { label: "Overview",    href: "/client" },
  { label: "Jobs",        href: "/client/jobs" },
  { label: "Invoices",    href: "/client/invoices" },
  { label: "Requests",    href: "/client/requests" },     // ← ADD
  { label: "New Request", href: "/client/requests/new" },
];
```

**Change 2:** Fix active-state logic to use exact match for `/client/requests`:
```typescript
// Before:
const active = pathname === href || (href !== "/client" && pathname.startsWith(href));

// After:
const exactMatch = href === "/client" || href === "/client/requests";
const active = pathname === href || (!exactMatch && pathname.startsWith(href));
```

---

#### `src/lib/data/client-portal.ts`

Add `ClientRequestItem` type, `RawRequestRow` local type, and `getClientRequests()` function as described in §3.1. No changes to existing `getClientJobs()` or `getClientInvoices()`.

---

### 3.3 No changes needed

| File | Reason |
|------|--------|
| Supabase schema | No new columns or tables |
| Supabase RLS | `service_requests_select` already enforces `client_id = auth_client_id()` |
| `src/lib/data/service-requests.ts` | Admin-only helper — leave untouched |
| `src/lib/utils.ts` | `fmtReqNumber`, `fmtDatetime`, `calcJobAge` already exported |
| `src/lib/constants.ts` | `REQUEST_STATUS_LABELS` already exported |

---

## 4. UI Behaviour Specification

### Request list page

```
/client/requests

┌─────────────────────────────────────────────────┐
│ Your Requests                                    │
│ 1 request                                        │
├─────────────────────────────────────────────────┤
│                                                  │
│  REQ-008                           [New]         │
│  DVR/NVR Issue  ·  Medium                        │
│  ───────────────────────────────────────         │
│  Submitted  May 26, 2026 · 06:02 AM              │
│  Age        Open for 2 days                      │
│  Issue      DVR appears offline after power...  │
│                                                  │
└─────────────────────────────────────────────────┘

 [+ Submit a new request →]
```

- `REQ-008` formatted via `fmtReqNumber(req.reqNumber)`
- Status badge shows `REQUEST_STATUS_LABELS[req.status]`
- Submitted time via `fmtDatetime(req.createdAt)`
- Age via `calcJobAge(req.createdAt, req.updatedAt, terminalStatus)` where `terminalStatus = req.status === "converted" ? "completed" : req.status`
- Description truncated (CSS `line-clamp-2`) — show only first 2 lines
- Footer link to `/client/requests/new` for easy re-submission

### Empty state

Shown when `requests.length === 0`:
```
No service requests on record for your account.
[Submit your first request →]
```

Link points to `/client/requests/new`.

---

## 5. Testing Checklist

| # | Test | Expected |
|---|------|----------|
| 1 | David Park (Metro Security Ltd) visits `/client/requests` | Sees exactly REQ-008 — not the 8 walk-in requests with `client_id = NULL` |
| 2 | Walk-in requests invisible | Confirmed by RLS: `NULL = auth_client_id()` → false → 0 rows returned for those |
| 3 | David Park submits a new request from `/client/requests/new` | After redirect or manual navigation to `/client/requests`, the new request appears at top (newest first) |
| 4 | Admin opens `/requests` | Same request appears in admin request list — no data isolation from admin view |
| 5 | `fmtReqNumber` formats correctly | `REQ-008` (not `8` or a raw UUID) |
| 6 | `fmtDatetime` formats correctly | `"May 26, 2026 · 06:02 AM"` |
| 7 | Age label for active request | "Open for X days" |
| 8 | Age label for converted request | "Completed in X days" (resolved via `converted → "completed"` mapping) |
| 9 | Empty state shown when 0 requests | Renders empty state message + submit link |
| 10 | "Requests" nav link active on `/client/requests` | Highlighted; "New Request" not highlighted |
| 11 | "New Request" nav link active on `/client/requests/new` | "New Request" highlighted; "Requests" NOT highlighted (exact-match fix) |
| 12 | Build: 0 TypeScript errors | `npm run build` passes — 26 routes |
| 13 | Lint: 0 warnings | `npm run lint` passes |

---

## 6. Files Affected — Complete Summary

| File | Action | Reason |
|------|--------|--------|
| `src/lib/data/client-portal.ts` | **MODIFY** | Add `ClientRequestItem` type + `getClientRequests()` |
| `src/components/client/ClientTopNav.tsx` | **MODIFY** | Add "Requests" nav link + fix active-state logic |
| `src/app/(client)/client/requests/page.tsx` | **CREATE** | New Server Component — request history list |
| `src/app/(client)/client/requests/loading.tsx` | **CREATE** | Skeleton loading state |
| `src/app/(client)/client/requests/error.tsx` | **CREATE** | Error boundary |
| Supabase schema | None | No migration needed |
| Supabase RLS | None | All policies already correct |
| `src/lib/data/service-requests.ts` | None | Admin-only — leave untouched |

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| `StatusBadge` does not render request status values correctly | Medium | Low | Verify at implementation; fall back to inline `<span>` with `REQUEST_STATUS_LABELS` |
| Walk-in requests leak to client view | None | High | `client_id = NULL` fails the RLS `client_id = auth_client_id()` check — confirmed by policy text and DB data |
| `calcJobAge` label misleading for cancelled request | Low | Low | "Completed in X days" is odd for cancelled — implement note: skip age row for cancelled, or override label |
| Nav dual-active on `/client/requests/new` | Low | Low | Fixed by exact-match condition change in `ClientTopNav` |
| Route count changes from 25 to 26 | None | None | Expected — one new Server Component page |

---

## 8. Conclusion

This is a **minimal, low-risk frontend feature**. RLS already correctly scopes the data. The data helper is a 20-line addition. The page follows the exact pattern of `client/jobs/page.tsx`.

**Implementation requires:**
- 3 new files (~50 lines total)
- 2 small edits to existing files

No migration, no RLS change, no schema change. Ready for Phase 10E-B.
