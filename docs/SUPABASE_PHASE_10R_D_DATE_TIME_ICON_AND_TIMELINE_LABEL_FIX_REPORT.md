# Phase 10R-D: Date/Time Icon Fix + Job Timeline Label

**Date:** 2026-05-31  
**Status:** COMPLETE — awaiting commit approval  
**Build:** ✅ 31 routes · 0 TypeScript errors  
**Lint:** ✅ 0 errors · 0 warnings  
**Based on audit:** `docs/SUPABASE_PHASE_10R_C_DATE_TIME_ICON_AUDIT_REPORT.md`

---

## Changes Made

### 1. `src/app/globals.css` — hide spin button, style clear button

Added two CSS blocks after the existing `::webkit-calendar-picker-indicator` rules:

```css
/* Hide inner spin button (Chromium's second dark icon inside datetime-local) */
input[type="date"]::-webkit-inner-spin-button,
input[type="datetime-local"]::-webkit-inner-spin-button {
  display: none;
}

/* Style the clear (×) button visible on dark backgrounds */
input[type="date"]::-webkit-clear-button,
input[type="datetime-local"]::-webkit-clear-button {
  filter: invert(1) brightness(1.8);
  opacity: 0.7;
}
```

The existing `::webkit-calendar-picker-indicator` block is **unchanged** — it continues to make the real picker icon white/visible.

### 2. `src/components/jobs/JobDetail.tsx` line 428 — label rename

```diff
- <span className="text-muted-foreground">Age</span>
+ <span className="text-muted-foreground">Time Open</span>
```

---

## Verification Checklist

| # | Check | Result |
|---|---|---|
| 1 | `/requests/[id]/convert` — Scheduled Date & Time: single visible picker icon, no dark duplicate | ✅ |
| 2 | `/requests/[id]/convert` — Deadline: same | ✅ |
| 3 | `/requests/new` (admin) — Preferred Date & Time: single icon | ✅ |
| 4 | `/client/requests/new` — Preferred date / time: single icon | ✅ |
| 5 | `/jobs` — JobBoard date tab: single icon | ✅ |
| 6 | Field with a value — clear (×) button visible (not dark) | ✅ |
| 7 | Clicking the picker icon opens the native date/time popup | ✅ |
| 8 | Admin `/jobs/[id]` timeline — shows "Time Open", not "Age" | ✅ |
| 9 | Technician portal timeline — still shows "Duration" (unchanged) | ✅ |
| 10 | Client portal timeline — still shows "Duration" (unchanged) | ✅ |
| 11 | `npm run build` — 0 errors, 31 routes | ✅ |
| 12 | `npm run lint` — 0 errors, 0 warnings | ✅ |

---

## Files Changed

| File | Lines changed | What |
|---|---|---|
| `src/app/globals.css` | +15 lines after line 174 | `::webkit-inner-spin-button { display: none }` + `::webkit-clear-button { filter: invert... }` |
| `src/components/jobs/JobDetail.tsx` | 1 line (428) | `"Age"` → `"Time Open"` |

**No component created. No form logic changed. No schema change. No new imports.**

---

## Commit Suggestion

```
fix: hide datetime-local spin-button, style clear-button, rename Age → Time Open

- globals.css: hide ::webkit-inner-spin-button on date/datetime-local inputs
  (Chromium's second dark icon inside datetime-local fields)
- globals.css: style ::webkit-clear-button with filter:invert so × is visible
  on dark backgrounds when a field has a value
- JobDetail.tsx: rename timeline label "Age" → "Time Open" to match clarity
  of technician/client portals which already use "Duration"
```
