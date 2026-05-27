# Phase 10A-E: Number Display Polish Report

**Date:** 2026-05-27
**Status:** Complete. Build and lint PASS.

---

## Scope

Replaced the two remaining raw UUID metadata displays documented in the Phase 10A-D report with formatted `REQ-XXXX` numbers using `fmtReqNumber()`.

---

## Changes Made

### 1. `src/components/requests/RequestDetail.tsx`

| What | Before | After |
|---|---|---|
| Import | `import { cn } from "@/lib/utils"` | `import { cn, fmtReqNumber } from "@/lib/utils"` |
| `RequestDetailData` type | no `requestNumber` field | added `requestNumber: number \| null` |
| Line 104 badge | `{requestId}` (full UUID) | `{fmtReqNumber(request.requestNumber)}` |

### 2. `src/app/(dashboard)/requests/[id]/page.tsx`

Added `requestNumber: raw.request_number ?? null` to the `RequestDetailData` object built from the DB row. No other changes.

### 3. `src/components/requests/ConvertJobForm.tsx`

| What | Before | After |
|---|---|---|
| Import | `import { cn } from …` + `import { fmtJobNumber } from …` (two lines) | merged: `import { cn, fmtJobNumber, fmtReqNumber } from "@/lib/utils"` |
| `ConvertRequestData` type | no `requestNumber` field | added `requestNumber: number \| null` |
| Line 162 badge | `{requestId}` (full UUID) | `{fmtReqNumber(request.requestNumber)}` |

### 4. `src/app/(dashboard)/requests/[id]/convert/page.tsx`

Added `requestNumber: raw.request_number ?? null` to the `ConvertRequestData` object built from the DB row. No other changes.

---

## Verification

### Build

```
✓ Compiled successfully
✓ TypeScript — 0 errors
✓ 25 routes generated
```

### Lint

```
✓ ESLint — 0 errors · 0 warnings
```

---

## Remaining Raw UUID Displays

None. All user-facing UUID short-segment hacks and full-UUID metadata badges have now been replaced with `fmtJobNumber()` / `fmtReqNumber()` across all three portals.

The `requestId` prop on both components is still passed for use in:
- Supabase `.update().eq("id", requestId)` calls (correct — UUID needed for DB operations)
- `href` link paths like `/requests/${requestId}/convert` (correct — route parameter is UUID)

These are not display uses and require no change.

---

## Summary

| Phase | Work | Status |
|---|---|---|
| 10A-A | Design plan | Complete |
| 10A-B | DB migration (sequences, backfill, triggers, constraints) | Complete |
| 10A-C | App/data layer (helpers, types, 20+ UI files) | Complete |
| 10A-D | End-to-end verification | Complete |
| 10A-E | Polish — replace remaining raw UUID metadata badges | **Complete** |
