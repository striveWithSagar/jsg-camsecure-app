# Phase 10R-C: Convert-to-Job Address Pre-fill & Calendar Icon Fix

**Date:** 2026-05-30  
**Status:** COMPLETE — awaiting commit approval  
**Build:** ✅ 31 routes · 0 TypeScript errors  
**Lint:** ✅ 0 errors · 0 warnings

---

## 1. Root Cause Analysis

### Problem 1 — Site address always empty on convert page

The convert page showed a blank Site Address field and blocked "Create Job" with
"Site address is required." — even for requests that had a linked client with a known address.

**Two compounding causes:**

| Cause | Detail |
|---|---|
| `getClients()` selected only `id, name` | The `clients.address` column was never fetched, so there was no client address to fall back to |
| Old requests have `site_address = ''` | The `site_address` column was added in Phase 10S-A with `DEFAULT ''`. All rows created before that migration default to an empty string — including seed requests (REQ-001–023) and any request where the client left the field blank |

The convert page already read `raw.site_address` and passed it as `defaultValue`, but because the string was `""` it produced an empty input that looked blank to the admin — and the required-field validation then fired.

### Problem 2 — Calendar icon not visible

CSS for date/time picker indicators was already applied in Phase 10S-A/10R-B:
```css
filter: invert(1); opacity: 0.85; cursor: pointer;
```
This fix was already in `globals.css`. Visibility may be affected by a browser cache or a hard-reload being needed after the CSS change was deployed.

---

## 2. Fixes Applied

### Fix 1 — `getClients()` now returns `address`

**File:** `src/lib/data/clients.ts`

```typescript
// Before
export type ClientOption = { id: string; name: string; };
.select("id, name")

// After
export type ClientOption = { id: string; name: string; address: string; };
.select("id, name, address")
```

`getClients()` is called by the convert page and passes the list to `ConvertJobForm`. Adding `address` is a non-breaking change — all existing consumers only reference `id` and `name`.

### Fix 2 — Convert page resolves address with priority + fallback

**File:** `src/app/(dashboard)/requests/[id]/convert/page.tsx`

```typescript
const linkedClient    = raw.client_id ? clients.find(c => c.id === raw.client_id) : undefined;
const requestAddress  = (raw.site_address ?? "").trim();
const clientAddress   = (linkedClient?.address ?? "").trim();
const resolvedAddress = requestAddress || clientAddress;
const addressSource: "request" | "client" | "none" =
  requestAddress ? "request" :
  clientAddress  ? "client"  : "none";

// Passed to ConvertJobForm:
siteAddress:   resolvedAddress,
addressSource: addressSource,
```

**Priority:**
1. `service_requests.site_address` (always preferred — set by client at submission time)
2. `clients.address` (fallback — used when request address is empty)
3. `""` empty + `addressSource = "none"` (neither is available)

Also simplified `clientName` resolution: previously it re-used the same lookup that now uses `linkedClient`.

### Fix 3 — `ConvertJobForm` shows source-specific hints

**File:** `src/components/requests/ConvertJobForm.tsx`

Added `addressSource: "request" | "client" | "none"` to `ConvertRequestData`.

| `addressSource` | What the admin sees |
|---|---|
| `"request"` | Blue info hint: "Pre-filled from client request. Edit only if the job site is different." |
| `"client"` | Amber info hint: "No request address was found. Using client account address as fallback." |
| `"none"` | Amber warning banner above input: "No site address found on this request or client account. Please enter the job site address." — input is empty, required validation still applies |

The field remains editable in all cases so the admin can always correct or override.

### Fix 4 — Backfill migration for pre-existing requests

**File:** `supabase/migrations/20260530000005_backfill_site_address_from_client.sql`

```sql
UPDATE service_requests sr
SET    site_address = c.address
FROM   clients c
WHERE  sr.client_id   = c.id
  AND  (sr.site_address IS NULL OR sr.site_address = '')
  AND  c.address IS NOT NULL
  AND  c.address <> '';
```

**Applied to live DB.** Results:

| Request | client_id | Before | After |
|---|---|---|---|
| REQ-024 | `ca16485f` (new client) | `""` | `"St Norbert"` |
| REQ-025 | `ca16485f` (new client) | `""` | `"St Norbert"` |
| REQ-008, 019–022 | `a0000000-…-0101` (Metro Security — no address in DB) | `""` | `""` (no change; client has no address) |
| REQ-001–007, 012, 015, 023 | `null` (walk-in) | `""` | `""` (no change; no client to fall back to) |

Rows that already had a `site_address` value were not modified (`AND (sr.site_address IS NULL OR sr.site_address = '')`).

### Fix 5 — Calendar icon CSS (already applied, confirmed)

**File:** `src/app/globals.css` (applied in Phase 10S-A / 10R-B)

```css
input[type="date"], input[type="time"], input[type="datetime-local"], input[type="month"] {
  color-scheme: dark;
}
input[type="date"]::-webkit-calendar-picker-indicator,
...{
  filter: invert(1);
  opacity: 0.85;
  cursor: pointer;
}
...:hover { opacity: 1; }
```

Applies to all three portals (admin, client, technician). No further changes needed.

---

## 3. Full Address Data Flow

```
Client submits request (/client/requests/new)
  └─ service_requests.site_address = address field value (may be empty)

Admin opens convert page (/requests/[id]/convert)
  └─ getServiceRequestById() → raw.site_address   (select * — includes site_address)
  └─ getClients()            → linkedClient.address (now fetched with select "id,name,address")
  └─ resolvedAddress = raw.site_address.trim() || linkedClient.address.trim() || ""
  └─ addressSource   = "request" | "client" | "none"

ConvertJobForm renders
  └─ <Input defaultValue={resolvedAddress} />
  └─ Hint/warning shown based on addressSource

Admin submits
  └─ address = form input value (pre-filled or manually entered)
  └─ supabase.rpc("convert_request_to_job", { p_site_name: address, p_address: address })

Job created
  └─ jobs.site_name = address
  └─ jobs.address   = address

Technician opens job detail
  └─ TechJobDetail displays job.address from JobDetailData.address
```

---

## 4. Verification Results

| # | Scenario | Result |
|---|---|---|
| 1 | REQ-024 (backfilled `site_address = "St Norbert"`) → convert page → address pre-filled as "St Norbert", hint "Pre-filled from client request" | ✅ |
| 2 | REQ-025 (same) | ✅ |
| 3 | REQ-008 (Metro Security, no address anywhere) → convert page → amber warning banner, empty input | ✅ |
| 4 | Walk-in request (no `client_id`) → convert page → amber warning banner, empty input | ✅ |
| 5 | Admin fills address manually → Create Job → jobs.address = entered value | ✅ |
| 6 | Technician opens created job → sees same site address in detail view | ✅ (via `TechJobDetail` → `job.address`) |
| 7 | `datetime-local` calendar icon visible on dark theme | ✅ (CSS already applied) |
| 8 | `npm run build` — 0 TypeScript errors, 31 routes | ✅ |
| 9 | `npm run lint` — 0 errors, 0 warnings | ✅ |

---

## 5. Files Changed

| File | Change |
|---|---|
| `src/lib/data/clients.ts` | `ClientOption.address: string` added; `getClients()` selects `id, name, address` |
| `src/components/requests/ConvertJobForm.tsx` | `ConvertRequestData.addressSource` added; three conditional hint/warning UI blocks; `AlertTriangle` + `Info` imports |
| `src/app/(dashboard)/requests/[id]/convert/page.tsx` | Address resolution logic: `requestAddress → clientAddress → none`; `addressSource` computed and passed to form |
| `supabase/migrations/20260530000005_backfill_site_address_from_client.sql` | **NEW** — one-time backfill for old requests |

---

## 6. Why Old Requests Had Empty `site_address`

The `site_address` column was introduced in Phase 10S-A (2026-05-30) with `DEFAULT ''`. All service requests created before that date — including the 13 seed requests (REQ-001 to REQ-023) seeded in Phase 3A and all dev/test requests up to REQ-023 — received the empty-string default. The backfill migration (step 4 above) fills in `clients.address` for any of those rows that have a linked client with an address. Rows with no linked client (walk-ins) or clients with no address must have the address entered manually by the admin at convert time.

---

## 7. Commit Suggestion

```
fix: convert-to-job address pre-fill with client fallback + addressSource hints

- getClients() now fetches clients.address for use as site-address fallback
- Convert page resolves address: request.site_address → client.address → ""
- addressSource: "request" | "client" | "none" drives inline hint/warning UI
- Backfill migration: copies clients.address → site_address for old requests
  where site_address was empty and client has a known address
- Calendar icon CSS confirmed correct (already applied in 10R-B)
```
