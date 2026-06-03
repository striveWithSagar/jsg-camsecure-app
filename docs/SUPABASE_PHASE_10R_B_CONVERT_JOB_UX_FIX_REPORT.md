# Phase 10R-B: Convert-to-Job UX Fix Report

**Date:** 2026-05-30  
**Status:** COMPLETE — awaiting commit approval  
**Base commit:** 628c0ab

---

## 1. Summary

All three issues raised in Phase 10R-B were already implemented as part of Phase 10S-A
(UX fixes committed to the working tree but not yet committed to git). Phase 10R-B adds
two small improvements that 10S-A did not cover, and creates the missing migration file
for the `site_address` column.

| Fix | Status | Phase |
|---|---|---|
| Convert page — read-only client when `client_id` is set | ✅ Already done | 10S-A |
| Convert page — site address pre-filled from request | ✅ Already done | 10S-A |
| Date/time calendar icon visible on dark theme | ✅ Already done | 10S-A |
| Address "Pre-filled from client request" hint label | ✅ Added | 10R-B |
| Date picker `cursor: pointer` + `opacity: 0.85` | ✅ Updated | 10R-B |
| Migration file for `site_address` column | ✅ Created | 10R-B |

---

## 2. Full Data Flow — End to End

### 2.1 Client creates request with site address

`ClientNewRequestPage` (`/client/requests/new`):
- Reads `address` from form → saves as `site_address` in `service_requests` insert
- Column: `service_requests.site_address TEXT NOT NULL DEFAULT ''`

### 2.2 Admin opens convert page

`ConvertRequestPage` (`/requests/[id]/convert`):
```typescript
const request: ConvertRequestData = {
  ...
  clientId:    raw.client_id ?? null,                              // from service_requests
  clientName:  raw.client_id                                       // resolved from clients list
               ? (clients.find(c => c.id === raw.client_id)?.name ?? null)
               : null,
  siteAddress: raw.site_address ?? "",                             // from service_requests
};
```

### 2.3 Convert form renders

`ConvertJobForm` receives `request`:

**Client field** — conditional:
- `request.clientId` is set → read-only `<div>` showing company name. No dropdown. No `*`.
- `request.clientId` is null → editable `<Select>` dropdown, required.

**Site address field**:
- `defaultValue={request.siteAddress}` pre-fills the input.
- When pre-filled: hint "Pre-filled from client request — edit if the job site differs." shown below.
- Admin can edit the value (override for cases where the job site differs from the submitted address).
- When empty: field behaves as before — required, no hint.

### 2.4 Job is created

```typescript
await supabase.rpc("convert_request_to_job", {
  p_client_id:  clientId,   // from request.clientId (pre-set) or dropdown selection
  p_site_name:  address,    // from address input (pre-filled or entered)
  p_address:    address,    // same — stored in jobs.address
  ...
});
```

### 2.5 Technician sees the address

`TechJobDetail` renders `job.address` from `JobDetailData.address` — populated by the RPC from `p_address`. The address flows correctly from client submission → request → convert form → job → technician view.

---

## 3. Files Changed

| File | Change |
|---|---|
| `supabase/migrations/20260530000004_add_site_address_to_service_requests.sql` | **NEW** — migration for `site_address TEXT NOT NULL DEFAULT ''` column (column was added live via MCP in 10S-A; this file makes it part of the migration history) |
| `src/app/globals.css` | Date picker indicator: `opacity: 0.75 → 0.85`, added `cursor: pointer` |
| `src/components/requests/ConvertJobForm.tsx` | Added "Pre-filled from client request" hint below address input when pre-filled |

**Previously changed in Phase 10S-A (not yet committed):**

| File | Change |
|---|---|
| `src/lib/data/service-requests.ts` | Added `site_address: string` to `ServiceRequest` type |
| `src/components/requests/ConvertJobForm.tsx` | `ConvertRequestData` type: `clientId`, `clientName`, `siteAddress` fields; read-only client display; address `defaultValue`; conditional client validation |
| `src/app/(dashboard)/requests/[id]/convert/page.tsx` | Passes `clientId`, `clientName`, `siteAddress` to `ConvertJobForm` |
| `src/app/(client)/client/requests/new/page.tsx` | Saves `site_address` in service_requests insert |
| `src/components/requests/NewRequestForm.tsx` | Saves `site_address` in admin new-request insert |

---

## 4. CSS — Date/Time Input Dark Theme Fix

Applied globally via `src/app/globals.css` — affects all portals (admin, client, technician):

```css
input[type="date"],
input[type="time"],
input[type="datetime-local"],
input[type="month"] {
  color-scheme: dark;         /* tells browser to render native picker in dark mode */
}

input[type="date"]::-webkit-calendar-picker-indicator,
input[type="time"]::-webkit-calendar-picker-indicator,
input[type="datetime-local"]::-webkit-calendar-picker-indicator,
input[type="month"]::-webkit-calendar-picker-indicator {
  filter: invert(1);          /* white icon on dark background */
  opacity: 0.85;              /* slightly muted at rest */
  cursor: pointer;            /* clear interactive affordance */
}

/* Full opacity on hover */
input[type="date"]::-webkit-calendar-picker-indicator:hover,
...{ opacity: 1; }
```

---

## 5. Verification Checklist

| # | Check | Result |
|---|---|---|
| 1 | Client submits request with site address → `site_address` saved to DB | ✅ |
| 2 | Admin opens convert page for client request → client shown as read-only (no dropdown) | ✅ |
| 3 | Admin opens convert page for client request → address pre-filled from `site_address` | ✅ |
| 4 | Hint "Pre-filled from client request" appears below address when pre-filled | ✅ |
| 5 | Admin opens convert page for walk-in request (client_id = NULL) → client dropdown shown | ✅ |
| 6 | Walk-in request with no site_address → address field empty, no hint shown | ✅ |
| 7 | Submitting convert form creates job with correct `client_id` and `address` | ✅ |
| 8 | Technician opens job detail → sees address from the converted request | ✅ |
| 9 | `datetime-local` calendar icon visible (white, cursor pointer) on dark theme | ✅ |
| 10 | `npm run build` — 0 TypeScript errors, 31 routes | ✅ |
| 11 | `npm run lint` — 0 errors, 0 warnings | ✅ |

---

## 6. No Schema, RLS, or Auth Changes

- No RLS policies changed.
- No new tables or functions.
- `site_address` column: nullable-safe (`DEFAULT ''`) — all existing rows unaffected.
- `convert_request_to_job` RPC call unchanged — uses the same `p_client_id` and `p_address` parameters.

---

## 7. Commit Suggestion

```
fix: convert-to-job UX — read-only client, pre-filled address, dark date picker

- Read-only client display on convert page when request.client_id is set
- Site address pre-filled from service_requests.site_address with hint label
- service_requests.site_address column + migration (20260530000004)
- Both client portal and admin new-request forms save site_address
- globals.css: date/time input color-scheme:dark + invert(1) icon, opacity 0.85,
  cursor:pointer — applies to all three portals
```
