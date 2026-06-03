# Phase 10R-C Audit: Date/Time Input Icon + Job Timeline Label

**Date:** 2026-05-31  
**Type:** Audit only — no code changes in this document  
**Status:** Findings ready for implementation approval

---

## Executive Summary

| Issue | Root cause | Fix complexity |
|---|---|---|
| Duplicate calendar icons | Chromium renders 2 native pseudo-elements for `datetime-local` — only one is styled | Minimal — 3 CSS lines |
| "Age" label unclear | Single hardcoded string in `JobDetail.tsx:428` | Trivial — 1 string change |

---

## 1. Duplicate Calendar Icon — Full Audit

### 1.1 What the code currently does

**No custom icon overlay exists.** The `DateTimeInput.tsx` wrapper (introduced in Phase 10R-D and deleted in Phase 10R-C) is gone. Every date/time input in the codebase is a plain `<Input>` component that renders a single `<input>` element — confirmed by tracing `@base-ui/react/input` → `Field.Control` → `useRenderElement('input', ...)`. No extra DOM, no injected icons.

**CSS currently applied** (`src/app/globals.css` lines 161–174):
```css
input[type="date"]::-webkit-calendar-picker-indicator,
input[type="time"]::-webkit-calendar-picker-indicator,
input[type="datetime-local"]::-webkit-calendar-picker-indicator,
input[type="month"]::-webkit-calendar-picker-indicator {
  filter: invert(1) brightness(1.8);
  opacity: 0.85;
  cursor: pointer;
}
```

This rule targets only `::webkit-calendar-picker-indicator`.

### 1.2 Root cause

Chromium on Windows renders **two separate native pseudo-elements** inside `input[type="datetime-local"]`:

| Pseudo-element | What it renders | Currently styled? |
|---|---|---|
| `::webkit-calendar-picker-indicator` | Calendar/clock icon on the far right — opens the picker popup | ✅ White (filter: invert) |
| `::webkit-inner-spin-button` | Up/down arrows or a secondary control for the time portion | ❌ Dark/black — not targeted by current CSS |

The `::webkit-inner-spin-button` is the second dark icon. Our CSS does not address it, so it renders in the browser's default dark color against the dark background.

For `input[type="date"]` (single-date, no time), Chromium typically renders only `::webkit-calendar-picker-indicator` — so the duplicate is most prominent on `datetime-local`.

**Dependency audit confirms no external source of icons:**
- `@base-ui/react` — zero CSS files, headless, renders a bare `<input>`
- `tailwindcss` — no date-picker-indicator rules
- `shadcn/tailwind.css` — no date-picker-indicator rules
- No custom Calendar icon components in any date input wrapper

### 1.3 All date/time inputs in the codebase

| File | Line | Type | Component | Currently affected? |
|---|---|---|---|---|
| `src/components/jobs/JobBoard.tsx` | 342 | `date` | Plain `<input>` (not `<Input>`) | Minor — single indicator, low visibility |
| `src/components/requests/NewRequestForm.tsx` | 250 | `datetime-local` | `<Input>` | ✅ Duplicate on Windows Chromium |
| `src/components/requests/ConvertJobForm.tsx` | 265 | `datetime-local` | `<Input>` | ✅ Duplicate on Windows Chromium |
| `src/components/requests/ConvertJobForm.tsx` | 273 | `datetime-local` | `<Input>` | ✅ Duplicate on Windows Chromium |
| `src/app/(client)/client/requests/new/page.tsx` | 389 | `datetime-local` | `<Input>` | ✅ Duplicate on Windows Chromium |

### 1.4 Recommended minimal fix

**File:** `src/app/globals.css`

Add two rules to target the inner spin button and the clear button:

```css
/* Hide inner spin buttons on date/datetime inputs — Chromium renders these
   as a second dark icon alongside the calendar indicator */
input[type="date"]::-webkit-inner-spin-button,
input[type="datetime-local"]::-webkit-inner-spin-button {
  display: none;
}

/* Style the clear button (×) that appears when the field has a value */
input[type="date"]::-webkit-clear-button,
input[type="datetime-local"]::-webkit-clear-button {
  filter: invert(1) brightness(1.8);
  opacity: 0.7;
}
```

No component changes needed. No imports. No new files.

**Why not remove `::webkit-calendar-picker-indicator` CSS?**  
That rule is working — it makes the real calendar icon white/visible. Only the spin button CSS is missing.

**Alternative (simpler) approach** if `::webkit-inner-spin-button` is not supported on all targets:
```css
/* Make ALL browser-native controls inside date/time inputs white on dark bg */
input[type="date"]::-webkit-inner-spin-button,
input[type="datetime-local"]::-webkit-inner-spin-button {
  filter: invert(1) brightness(1.8);
  opacity: 0.7;
  cursor: pointer;
}
```
(styling it white instead of hiding it; still reads as "two icons" but both are now visible and light)

---

## 2. "Age" Timeline Label — Full Audit

### 2.1 Where "Age" appears

| File | Line | Portal | Context |
|---|---|---|---|
| `src/components/jobs/JobDetail.tsx` | **428** | **Admin** | Job detail sidebar — timeline section, row label for elapsed time |

```tsx
// src/components/jobs/JobDetail.tsx  line 427–432
<div className="flex justify-between gap-2 pt-0.5">
  <span className="text-muted-foreground">Age</span>          ← this line
  <span className={`font-semibold ...`}>
    {ageInfo.label}
  </span>
</div>
```

### 2.2 How other portals label the same value

| File | Portal | Current label |
|---|---|---|
| `src/components/jobs/JobDetail.tsx:428` | Admin | **Age** ← to fix |
| `src/components/technician/TechJobDetail.tsx:100` | Technician | Duration |
| `src/app/(client)/client/jobs/[id]/page.tsx:130` | Client | Duration |
| `src/app/(client)/client/requests/[id]/page.tsx:102` | Client | Duration |

Only the admin portal uses "Age". All other portals already say "Duration".

### 2.3 What `ageInfo.label` contains

`calcJobAge()` from `src/lib/utils.ts` returns an object with `{ label: string, isComplete: boolean }`.
- For open jobs: label is like `"3d 14h"` (elapsed since creation)
- For completed jobs: label is like `"2d 4h"` (from creation to completion)

"Age" is technically accurate but less clear than "Duration" in both open and completed contexts.

### 2.4 Recommended label

Change `"Age"` → `"Time Open"`.

Rationale:
- More descriptive than "Age" — makes it clear this is time elapsed, not a person's age
- "Duration" (used elsewhere) is also fine but is slightly ambiguous for open jobs (duration implies it's over)
- "Time Open" is accurate for both states: running time for open jobs, total time-open for completed jobs
- Consistent reading across states: "Time Open: 3d 14h" ✅ whether the job is open or finished

**Alternative:** `"Duration"` — matches the technician and client portals exactly, simpler, and `calcJobAge` already returns a duration-style label. This would make all three portals identical. This is also acceptable.

---

## 3. No Changes Found Needed Elsewhere

| Area | Checked | Finding |
|---|---|---|
| `src/components/ui/DateTimeInput.tsx` | Deleted in Phase 10R-C | Not present |
| `@base-ui/react` package | Audited | Pure headless, zero CSS, single `<input>` render |
| `shadcn/tailwind.css` | Checked | No date picker rules |
| Tailwind v4 dist | Checked | No date picker rules |
| `.next/static/css` (compiled) | Checked | No duplicate calendar rules |
| `Calendar` imports near date inputs | Grepped | None — only in `JobBoard.tsx` (section header icon, unrelated to inputs) and `technicians/[id]/page.tsx` (join date display icon, unrelated to inputs) |

---

## 4. Verification Checklist (for implementation phase)

| # | Check |
|---|---|
| 1 | `/requests/[id]/convert` — Scheduled Date & Time shows exactly 1 icon, visibly white |
| 2 | `/requests/[id]/convert` — Deadline shows exactly 1 icon, visibly white |
| 3 | `/requests/new` (admin) — Preferred Date & Time shows exactly 1 icon, visibly white |
| 4 | `/client/requests/new` — Preferred date / time shows exactly 1 icon, visibly white |
| 5 | `/jobs` — JobBoard tab date picker shows exactly 1 icon, visibly white |
| 6 | Clicking the icon opens the native date/time picker |
| 7 | `datetime-local` field with a value — no dark spin-button/clear-button visible |
| 8 | Admin job detail timeline — label reads "Time Open" (not "Age") |
| 9 | Technician and client portals — label still reads "Duration" (unchanged) |
| 10 | `npm run build` — 0 TypeScript errors |
| 11 | `npm run lint` — 0 errors, 0 warnings |

---

## 5. Files to Change in Implementation Phase

| File | Lines | Change |
|---|---|---|
| `src/app/globals.css` | after line 174 | Add `::webkit-inner-spin-button` + `::webkit-clear-button` rules |
| `src/components/jobs/JobDetail.tsx` | 428 | `"Age"` → `"Time Open"` |

**Total: 2 files, ~5 lines changed.**
