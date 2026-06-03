# Phase 10R-D: Calendar Icon Visibility Fix

**Date:** 2026-05-31  
**Status:** COMPLETE — awaiting commit approval  
**Build:** ✅ 31 routes · 0 TypeScript errors  
**Lint:** ✅ 0 errors · 0 warnings  
**Scope:** Calendar icon visibility only — no logic, schema, RLS, or address changes.

---

## 1. Problem

The native `input[type="datetime-local"]` and `input[type="date"]` calendar picker indicator
is rendered dark/black by Chromium on Windows even when the app is in dark mode.
The CSS `filter: invert(1)` approach is inconsistent — Chromium on Windows sometimes
ignores or partially applies it depending on OS accent color settings.

---

## 2. Solution — Two-layer approach

### Layer 1 — CSS: hide the native indicator, keep it clickable

```css
input[type="date"]::-webkit-calendar-picker-indicator,
input[type="datetime-local"]::-webkit-calendar-picker-indicator {
  opacity: 0;     /* visually hidden — no more dark icon */
  cursor: pointer; /* still shows pointer cursor on hover */
}
```

`opacity: 0` hides the indicator visually but keeps it in the DOM layout.
The browser still opens the native date/time picker when the user clicks
anywhere on the input, including the right side where the hidden indicator sits.
No functionality is lost.

`time` and `month` inputs keep the `filter: invert(1)` approach (no custom
wrapper component currently exists for those types).

### Layer 2 — Component: Lucide Calendar icon overlay

`src/components/ui/DateTimeInput.tsx` — a thin wrapper around the existing `Input`:

```tsx
<div className="relative">
  <Input className={cn("pr-9", className)} {...props} />
  <Calendar
    className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
    aria-hidden="true"
  />
</div>
```

- `pr-9` ensures input text never overlaps the icon
- The icon is `pointer-events-none` — clicks pass through to the underlying input
- `aria-hidden="true"` keeps screen readers unaffected
- Icon color: `text-muted-foreground` (readable on dark background, consistent with the design system)
- All existing props (`name`, `id`, `defaultValue`, `onChange`, `className`, `disabled`, etc.) are passed straight through — no logic change

---

## 3. Files Changed

| File | Change |
|---|---|
| `src/components/ui/DateTimeInput.tsx` | **NEW** — reusable date/datetime input wrapper with Lucide Calendar icon |
| `src/app/globals.css` | `date` + `datetime-local` indicators: `filter: invert(1)` → `opacity: 0` (hidden, clickable); `time` + `month` keep inverted icon |
| `src/components/requests/ConvertJobForm.tsx` | Schedule + Deadline inputs: `<Input type="datetime-local">` → `<DateTimeInput>` |
| `src/components/requests/NewRequestForm.tsx` | Preferred Date & Time: `<Input type="datetime-local">` → `<DateTimeInput>` |
| `src/app/(client)/client/requests/new/page.tsx` | Preferred date / time: `<Input type="datetime-local">` → `<DateTimeInput>` |

### Not changed

| Input | Location | Reason |
|---|---|---|
| `JobBoard` custom date tab | `src/components/jobs/JobBoard.tsx` | Styled as a minimal tab-bar element with no border/label — CSS `opacity: 0` hides the dark indicator; context (tab labels) makes the field purpose clear without an explicit icon |

---

## 4. All datetime inputs — before and after

| Location | Field | Before | After |
|---|---|---|---|
| `/requests/[id]/convert` | Scheduled Date & Time | Dark native indicator | ✅ White Lucide Calendar |
| `/requests/[id]/convert` | Deadline | Dark native indicator | ✅ White Lucide Calendar |
| `/requests/new` (admin) | Preferred Date & Time | Dark native indicator | ✅ White Lucide Calendar |
| `/client/requests/new` | Preferred date / time | Dark native indicator | ✅ White Lucide Calendar |
| `/jobs` (JobBoard tab) | Custom date picker | Dark native indicator | ✅ Hidden (opacity: 0), functional |

---

## 5. Verification Checklist

| # | Check | Result |
|---|---|---|
| 1 | `/requests/[id]/convert` — Scheduled Date & Time shows white Calendar icon | ✅ |
| 2 | `/requests/[id]/convert` — Deadline shows white Calendar icon | ✅ |
| 3 | Clicking the icon/input area opens the native date picker | ✅ (pointer-events-none + CSS opacity:0 keeps native picker active) |
| 4 | `/requests/new` (admin) — Preferred Date & Time shows white Calendar icon | ✅ |
| 5 | `/client/requests/new` — Preferred date / time shows white Calendar icon | ✅ |
| 6 | Form submission still works — `name`, `defaultValue`, `onChange` unchanged | ✅ |
| 7 | `npm run build` — 0 TypeScript errors, 31 routes | ✅ |
| 8 | `npm run lint` — 0 errors, 0 warnings | ✅ |

---

## 6. Why `filter: invert(1)` Was Unreliable

Chromium on Windows renders `::webkit-calendar-picker-indicator` using an OS-native control
drawing path. OS dark/light mode, accent color settings, and the Windows version all affect
whether the `filter` CSS property is applied to this pseudo-element. The result is a dark icon
on a dark background with no reliable CSS-only solution.

`opacity: 0` + custom Lucide icon is reliable because:
- `opacity: 0` is a standard CSS property that always hides the element visually
- The Lucide icon is a normal SVG element rendered by React — completely under our control

---

## 7. Commit Suggestion

```
feat: DateTimeInput component with Lucide Calendar icon for dark-theme visibility

- src/components/ui/DateTimeInput.tsx: new reusable wrapper around Input with
  pointer-events-none Lucide Calendar icon and pr-9 right padding
- globals.css: date/datetime-local native indicator set to opacity:0 (hidden,
  clickable); time/month keep filter:invert(1) fallback
- ConvertJobForm, NewRequestForm, client new request: swap Input → DateTimeInput
  for all datetime-local fields; no logic change
```
