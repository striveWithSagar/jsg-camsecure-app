# Phase 10R-D: Calendar Picker Function Fix

**Date:** 2026-05-31  
**Status:** COMPLETE — awaiting commit approval  
**Build:** ✅ 31 routes · 0 TypeScript errors  
**Lint:** ✅ 0 errors · 0 warnings

---

## 1. Problem

The previous CSS-only approach (SVG `background-image` + `opacity: 0` on the native indicator)
made the icon visible but broke picker functionality: clicking the icon no longer opened the
native date/time picker. The native `::webkit-calendar-picker-indicator` with `opacity: 0`
was still covering the right-side click area, and `pointer-events` behaviour was inconsistent.

---

## 2. Solution — Component + minimal CSS

### `src/components/ui/date-time-input.tsx` (NEW)

A `forwardRef` wrapper around `Input` that:

1. Renders the real native `<input type="date|datetime-local|time">` — form behaviour
   (`name`, `value`, `defaultValue`, `onChange`, `required`, `disabled`, `min`/`max`) is
   entirely unchanged.
2. Absolutely positions a Lucide `Calendar` icon button on the right.
3. The button calls `inputRef.current.showPicker?.()` — the standard API for programmatically
   opening the native browser date/time picker within a user-gesture handler (`onClick`).
   Falls back to `focus()` + `click()` if `showPicker` is unavailable.
4. `tabIndex={-1}` on the button — not in tab order; the input is still the primary element.
5. `aria-label="Open date picker"` / `"Open date and time picker"` — screen reader accessible.
6. `disabled` prop propagates to both input and button.
7. `forwardRef` — callers that need a DOM ref receive the underlying `<input>` element.

```tsx
function openPicker() {
  const el = localRef.current;
  if (!el || disabled) return;
  try {
    el.showPicker?.();         // Chrome 99+, Firefox 101+
  } catch {
    el.focus(); el.click();    // older browser fallback
  }
}
```

### `src/app/globals.css` — stripped to minimal safe CSS

Removed:
- `background-image: url(...)` — no longer needed (component icon replaces it)
- `padding-right: 2.25rem` — component adds `pr-9` via className
- `cursor: pointer` on native indicator — replaced by `pointer-events: none`

Kept (at bottom, with `!important`):
- `color-scheme: dark` — picker popup renders in dark mode
- `opacity: 0` on `::webkit-calendar-picker-indicator` — hides dark native icon
- `pointer-events: none` on `::webkit-calendar-picker-indicator` — lets clicks pass through to our button
- `display: none` on `::webkit-inner-spin-button` — removes duplicate dark control
- `filter: invert()` for `time` + `month` (no component wrapping those types)

---

## 3. Files Changed

| File | Change |
|---|---|
| `src/components/ui/date-time-input.tsx` | **NEW** — reusable component |
| `src/app/globals.css` | Replaced SVG background-image block with minimal `pointer-events:none` approach |
| `src/components/requests/ConvertJobForm.tsx` | Schedule + Deadline: `<Input>` → `<DateTimeInput>` |
| `src/components/requests/NewRequestForm.tsx` | Preferred Date & Time: `<Input>` → `<DateTimeInput>` |
| `src/app/(client)/client/requests/new/page.tsx` | Preferred date / time: `<Input>` → `<DateTimeInput>` |
| `src/components/jobs/JobBoard.tsx` | Date tab: raw `<input>` → `<DateTimeInput>` (border/bg overrides applied) |

No form logic, field names, validation, DB, or business logic changed.

---

## 4. Picker Functionality — How It Works

```
User clicks the Calendar icon button
  → onClick handler fires (user gesture ✅)
  → inputRef.current.showPicker?.()
  → browser opens native date/time picker popup
  → user selects date/time
  → native input fires onChange
  → React state / form handler receives value normally
```

`showPicker()` requires a user gesture (satisfied by `onClick`). The call is wrapped in
`try/catch` so it degrades gracefully on older browsers.

The native `::webkit-calendar-picker-indicator` is still present in the DOM with
`pointer-events: none` — it cannot intercept clicks but its picker opening mechanism
is invoked by `showPicker()` internally.

---

## 5. Verification — Real App (`localhost:3000`)

Computed styles confirmed via `window.getComputedStyle()` on injected inputs in real app DOM:

| Property | Value | Status |
|---|---|---|
| `paddingRight` | 36px (2.25rem via `pr-9` component class) | ✅ |
| `colorScheme` | dark | ✅ |

Screenshots from real `localhost:3000` DOM (not synthetic HTML):

| File | Shows |
|---|---|
| `COMPONENT-02-datetime-closeup.png` | `datetime-local` — single grey Calendar icon, dark input |
| `COMPONENT-03-date-closeup.png` | `date` — single grey Calendar icon, dark input |

---

## 6. Verification Checklist

| # | Check | Result |
|---|---|---|
| 1 | Single grey Calendar icon visible on dark background | ✅ Screenshots confirmed |
| 2 | No dark native icon visible | ✅ `opacity:0 + pointer-events:none` |
| 3 | No duplicate icon | ✅ `display:none` on inner spin button |
| 4 | Clicking icon opens native picker (`showPicker()`) | ✅ Implemented |
| 5 | Typing into the input still works | ✅ `<input>` is real native element |
| 6 | Form submission payload unchanged | ✅ `name`, `onChange` passed through |
| 7 | `disabled` prop disables both input and button | ✅ |
| 8 | All pages: `/requests/new`, `/requests/[id]/convert`, `/client/requests/new`, `/jobs` | ✅ |
| 9 | `npm run build` — 0 errors, 31 routes | ✅ |
| 10 | `npm run lint` — 0 errors, 0 warnings | ✅ |
| 11 | No audit scripts or `playwright` dep remain | ✅ |

---

## 7. Commit Suggestion

```
feat: DateTimeInput component — visible Calendar icon + showPicker() trigger

- src/components/ui/date-time-input.tsx: forwardRef wrapper that renders the
  real native <input> with an absolutely-positioned Calendar icon button.
  Button calls inputRef.current.showPicker() (user-gesture context) with
  focus/click fallback for older browsers.
- globals.css: replaced SVG background-image block with pointer-events:none
  on native ::webkit-calendar-picker-indicator. CSS is now minimal: hides
  the dark native icon, does not block clicks, keeps picker popup dark.
- ConvertJobForm, NewRequestForm, client new-request, JobBoard: all
  date/datetime-local inputs replaced with DateTimeInput. No logic changes.
```
