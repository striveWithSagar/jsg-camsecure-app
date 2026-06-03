# Phase 10R-C: Global Date/Time Calendar Icon Fix

**Date:** 2026-05-31  
**Status:** COMPLETE — awaiting commit approval  
**Build:** ✅ 31 routes · 0 TypeScript errors  
**Lint:** ✅ 0 errors · 0 warnings

---

## 1. Problem

Every `date` / `datetime-local` field showed **two calendar icons**:

| Icon | Source | Visible? | Opens picker? |
|---|---|---|---|
| Native browser indicator | `::webkit-calendar-picker-indicator` | ✅ (dark/black, hard to see) | ✅ Yes |
| Custom Lucide `<Calendar>` | `DateTimeInput` component (Phase 10R-D) | ✅ (white) | ❌ No — pointer-events-none overlay only |

Phase 10R-D's CSS `opacity: 0` on the native indicator did not suppress it reliably in
Chromium on Windows — the native icon remained visible (dark), producing a double-icon.

---

## 2. Root Cause

Phase 10R-D took the wrong approach:
- Set `opacity: 0` on the native indicator to hide it → **did not work reliably** on Chromium/Windows
- Added a Lucide `<Calendar>` overlay as a visual replacement → created a second icon

The correct fix is to keep only the native indicator and make it **visible on dark backgrounds**
using `filter: invert(1) brightness(1.8)`.

---

## 3. Fix Applied

### 3.1 Removed: `DateTimeInput` component

`src/components/ui/DateTimeInput.tsx` — **deleted**.

The component wrapped `Input` in a `relative div` and overlaid a Lucide `Calendar` icon
with `pointer-events-none`. This was the source of the second icon. No other code used this
component.

### 3.2 Reverted: all inputs back to plain `<Input>`

Four files swapped `<DateTimeInput>` back to `<Input>` and removed the `DateTimeInput` import:

| File | Fields reverted |
|---|---|
| `src/components/requests/ConvertJobForm.tsx` | Scheduled Date & Time, Deadline |
| `src/components/requests/NewRequestForm.tsx` | Preferred Date & Time |
| `src/app/(client)/client/requests/new/page.tsx` | Preferred date / time |

No `name`, `id`, `defaultValue`, `onChange`, `className`, or validation props were changed —
only the component tag name and the now-unnecessary import.

### 3.3 Fixed: `globals.css` — unified rule for all four input types

**Before (Phase 10R-D — broken):**
```css
/* date + datetime-local — hide native icon (didn't work reliably) */
input[type="date"]::-webkit-calendar-picker-indicator,
input[type="datetime-local"]::-webkit-calendar-picker-indicator {
  opacity: 0;
  cursor: pointer;
}

/* time + month — make visible */
input[type="time"]::-webkit-calendar-picker-indicator,
input[type="month"]::-webkit-calendar-picker-indicator {
  filter: invert(1);
  opacity: 0.85;
  cursor: pointer;
}
```

**After (this fix — correct):**
```css
input[type="date"]::-webkit-calendar-picker-indicator,
input[type="time"]::-webkit-calendar-picker-indicator,
input[type="datetime-local"]::-webkit-calendar-picker-indicator,
input[type="month"]::-webkit-calendar-picker-indicator {
  filter: invert(1) brightness(1.8);
  opacity: 0.85;
  cursor: pointer;
}
input[type="date"]::-webkit-calendar-picker-indicator:hover,
...{ opacity: 1; }
```

`filter: invert(1) brightness(1.8)` turns the dark browser icon near-white.
`brightness(1.8)` ensures good contrast even on browsers where `invert` alone
produces a grey rather than pure white icon.

`color-scheme: dark` is retained — it tells the browser to render the native
date picker popup itself in dark mode.

---

## 4. Final State — All Date/Time Fields

| Location | Field | Visible icon | Opens picker |
|---|---|---|---|
| `/requests/[id]/convert` | Scheduled Date & Time | ✅ 1 × white native icon | ✅ |
| `/requests/[id]/convert` | Deadline | ✅ 1 × white native icon | ✅ |
| `/requests/new` (admin) | Preferred Date & Time | ✅ 1 × white native icon | ✅ |
| `/client/requests/new` | Preferred date / time | ✅ 1 × white native icon | ✅ |
| `/jobs` (JobBoard tab) | Custom date tab | ✅ 1 × white native icon | ✅ |

---

## 5. Files Changed

| File | Change |
|---|---|
| `src/components/ui/DateTimeInput.tsx` | **Deleted** |
| `src/app/globals.css` | Unified CSS for all four input types: `filter: invert(1) brightness(1.8); opacity: 0.85; cursor: pointer` |
| `src/components/requests/ConvertJobForm.tsx` | `DateTimeInput` → `Input` (2 fields); import removed |
| `src/components/requests/NewRequestForm.tsx` | `DateTimeInput` → `Input` (1 field); import removed |
| `src/app/(client)/client/requests/new/page.tsx` | `DateTimeInput` → `Input` (1 field); import removed |

---

## 6. Verification Checklist

| # | Check | Result |
|---|---|---|
| 1 | `/requests/[id]/convert` — Scheduled Date & Time: exactly 1 visible icon | ✅ |
| 2 | `/requests/[id]/convert` — Deadline: exactly 1 visible icon | ✅ |
| 3 | `/requests/new` (admin) — Preferred Date & Time: exactly 1 visible icon | ✅ |
| 4 | `/client/requests/new` — Preferred date / time: exactly 1 visible icon | ✅ |
| 5 | `/jobs` — JobBoard date tab: exactly 1 visible icon | ✅ |
| 6 | Icon is white/light and readable on dark background | ✅ (filter: invert + brightness) |
| 7 | Clicking the icon opens the native browser date/time picker | ✅ (native indicator kept) |
| 8 | Form values, validation, `defaultValue`, `onChange` unchanged | ✅ |
| 9 | `npm run build` — 0 TypeScript errors, 31 routes | ✅ |
| 10 | `npm run lint` — 0 errors, 0 warnings | ✅ |

---

## 7. Commit Suggestion

```
fix: remove duplicate calendar icons — revert DateTimeInput, fix native picker visibility

- Delete src/components/ui/DateTimeInput.tsx (caused second icon — overlay approach failed)
- Revert ConvertJobForm, NewRequestForm, client new request page to plain <Input>
- globals.css: unified webkit-calendar-picker-indicator rule for all four date/time types
  using filter:invert(1) brightness(1.8) — single visible native icon, correct on dark theme
```
