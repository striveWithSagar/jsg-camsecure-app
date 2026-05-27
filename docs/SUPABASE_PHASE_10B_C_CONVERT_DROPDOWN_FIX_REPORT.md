# Phase 10B-C: Convert-to-Job Dropdown UUID Fix Report

**Date:** 2026-05-27
**Status:** Complete. Build and lint PASS.

---

## Bug Fixed

On `/requests/[id]/convert`, the **Client Account** and **Technician** dropdowns displayed raw UUID values in the `SelectTrigger` instead of human-readable names, both on page load and after a selection was made.

---

## Root Cause

Same as BUG-01 in Phase 10B-B: the project uses **Base UI** (`@base-ui/react/select`), not Radix UI. `SelectPrimitive.Value` (Base UI's `SelectValue`) resolves its display label by reading item text from a lazily-mounted Portal popup. The popup is only mounted on demand; on first render it is not in the DOM. Base UI falls back to rendering the raw controlled `value` prop — which is the UUID.

`ConvertJobForm.tsx` had `<SelectValue placeholder="…" />` inside both the Client Account and Technician triggers, where the controlled values (`clientId`, `technicianId`) are UUIDs.

---

## App-wide Audit — Other `SelectValue` Usages

All six files containing `SelectValue` were audited:

| File | Select value bound to | UUID? | Action |
|---|---|---|---|
| `components/jobs/JobDetail.tsx` | `technicianId` UUID | Yes | Fixed in Phase 10B-B |
| `components/requests/ConvertJobForm.tsx` | `clientId`, `technicianId` UUIDs | Yes | **Fixed this phase** |
| `components/requests/ConvertJobForm.tsx` | `priority` enum | No | Left as-is |
| `components/requests/RequestDetail.tsx` | `status` enum | No | Safe |
| `components/requests/NewRequestForm.tsx` | `serviceType`, `urgency` enums | No | Safe |
| `app/(client)/client/requests/new/page.tsx` | `serviceType`, `urgency` enums | No | Safe |

No other UUID-bound `SelectValue` bugs exist in the codebase.

---

## Type Verification

**`ClientOption`** (`src/lib/data/clients.ts:33`):
```ts
export type ClientOption = {
  id:   string;
  name: string;   // ← field used for display
};
```

**`TechnicianOption`** (`src/lib/data/technicians.ts:81`):
```ts
export type TechnicianOption = {
  id:        string;
  full_name: string;   // ← field used for display
  specialty: string | null;
  status:    string;
};
```

---

## Changes Made

**File:** `src/components/requests/ConvertJobForm.tsx`

### Client Account trigger (lines 186–188 → 186–190)

```tsx
// Before
<SelectTrigger className={cn("h-9 text-sm", errors.clientId && "border-destructive")}>
  <SelectValue placeholder="Select client" />
</SelectTrigger>

// After
<SelectTrigger className={cn("h-9 text-sm", errors.clientId && "border-destructive")}>
  <span className="truncate">
    {clients.find(c => c.id === clientId)?.name ?? "Select client"}
  </span>
</SelectTrigger>
```

### Technician trigger (lines 205–207 → 205–209)

```tsx
// Before
<SelectTrigger className={cn("h-9 text-sm", errors.technicianId && "border-destructive")}>
  <SelectValue placeholder="Assign technician" />
</SelectTrigger>

// After
<SelectTrigger className={cn("h-9 text-sm", errors.technicianId && "border-destructive")}>
  <span className="truncate">
    {technicians.find(t => t.id === technicianId)?.full_name ?? "Select technician"}
  </span>
</SelectTrigger>
```

### Priority trigger — unchanged

`Select value={priority}` binds to an enum string (`"medium"`, `"high"`, etc.) — not a UUID — so `<SelectValue />` is safe here and left as-is.

`SelectValue` remains in the import because it is still used by the Priority trigger.

---

## Why This Is Definitively Correct

| Scenario | Client trigger renders | Technician trigger renders |
|---|---|---|
| Initial load, nothing selected | `"Select client"` (placeholder text) | `"Select technician"` (placeholder text) |
| User opens dropdown, selects "Metro Security Ltd" | `clients.find(c => c.id === newId)?.name` → `"Metro Security Ltd"` | — |
| User opens dropdown, selects "Jordan Kim" | — | `technicians.find(t => t.id === newId)?.full_name` → `"Jordan Kim"` |
| Page refresh after conversion | Only reached if status is already `"converted"` — different UI branch shown | — |

The `value` prop on `<Select>` remains the UUID (`clientId` / `technicianId`). The RPC call:

```ts
await supabase.rpc("convert_request_to_job", {
  p_client_id:     clientId,      // UUID — unchanged
  p_technician_id: technicianId,  // UUID — unchanged
  ...
})
```

is completely unaffected.

---

## DB Write Verification

The `convert_request_to_job` RPC requires `auth.uid()` — it cannot be called via MCP `execute_sql` without a live session (raises `P0001: Not authenticated`). DB write path verified by code audit:

- `p_client_id: clientId` — `clientId` state is set by `onValueChange`, which receives the UUID from `SelectItem value={c.id}`
- `p_technician_id: technicianId` — same pattern via `SelectItem value={t.id}`
- The display label (`<span>` content) has no connection to `onValueChange` or the RPC payload

The display path and the data path are fully decoupled.

---

## Build

```
✓ Compiled successfully
✓ TypeScript — 0 errors
✓ 25 routes generated
```

## Lint

```
✓ ESLint — 0 errors · 0 warnings
```

---

## Files Changed

| File | Change |
|---|---|
| `src/components/requests/ConvertJobForm.tsx` | Replace `SelectValue` in Client Account and Technician triggers with `<span>` rendering direct JS array lookups |

---

## Manual Verification Required

Direct browser testing is not available in this environment (auth guard). Please verify in your browser:

1. Open `/requests/[id]/convert` for any unconverted request
2. Confirm **Client Account** dropdown shows `"Select client"` (not a UUID) on load
3. Select a client — confirm the trigger label updates to the client name (e.g. `"Metro Security Ltd"`)
4. Confirm **Technician** dropdown shows `"Select technician"` on load
5. Select a technician — confirm the trigger label updates to the technician name (e.g. `"Jordan Kim"`)
6. Optionally: complete the conversion form and confirm the resulting job has the correct `client_id` and `technician_id` UUIDs in Supabase

---

## Summary

The UUID display bug on `/requests/[id]/convert` was the same root cause as BUG-01 in Phase 10B-B: Base UI's `SelectPrimitive.Value` resolves labels via a lazily-mounted Portal and falls back to the raw UUID `value` prop. Both UUID-bound triggers (Client Account, Technician) in `ConvertJobForm.tsx` were fixed by replacing `SelectValue` with a `<span>` that renders the human-readable name from a direct JS array lookup. The RPC payload, validation logic, and all other form behavior are unchanged. No other UUID-bound `SelectValue` bugs exist in the codebase.
