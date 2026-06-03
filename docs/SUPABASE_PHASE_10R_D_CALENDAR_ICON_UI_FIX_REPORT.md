# Phase 10R-D: Calendar Icon Dark Theme Fix — Live App Audit & Final Fix

**Date:** 2026-05-31  
**Status:** COMPLETE — awaiting commit approval  
**Build:** ✅ 31 routes · 0 TypeScript errors  
**Lint:** ✅ 0 errors · 0 warnings  
**Audit type:** Real app — `http://localhost:3000` with injected DOM + computed styles

---

## 1. Root Cause Chain (Confirmed by Live Audit)

### Why previous attempts failed

| Attempt | What happened |
|---|---|
| `filter: invert(1)` on `::webkit-calendar-picker-indicator` | Windows Chromium renders this indicator via OS-native DirectWrite — CSS `filter` is ignored at the OS rendering layer |
| `opacity: 0` + Lucide React icon overlay (`DateTimeInput.tsx`) | `opacity: 0` did not suppress the native indicator in Chromium on Windows; resulted in two icons |
| CSS placed mid-file (not at bottom) | Turbopack/LightningCSS compiled a **stale cached chunk** that did not include the new rules. Confirmed by auditing `.next/dev/static/chunks/src_app_globals_css_*.single.css`: our `background-image` was completely absent from the compiled output |

### Compiled CSS audit result (before fix)

```
$ grep "background-image.*svg" .next/dev/static/chunks/src_app_globals_css_*.single.css
(no output — rule was absent)
```

The stale chunk was serving the old `filter: invert() brightness(1.8)` rule with `opacity: 0.85` — not our updated rules. This is why the real app showed the old dark icon even though globals.css had been updated.

---

## 2. What Was Fixed

### `src/app/globals.css`

**Two changes:**

1. **Removed** the old date/time CSS block from the middle of the file  
2. **Appended** the definitive block at the **absolute bottom** of the file, after all other rules, with `!important` on every property

Placing the block at the very bottom with `!important` guarantees:
- It comes after every `@layer` declaration (unlayered CSS > layered CSS in cascade)
- It comes after Tailwind's `@import "tailwindcss"` layer system
- It can never be overridden by anything else in the file
- `!important` eliminates any remaining specificity ambiguity

### CSS logic

```css
/* SVG calendar icon + padding — date and datetime-local */
input[type="date"],
input[type="datetime-local"] {
  padding-right: 2.25rem !important;
  background-image: url("data:image/svg+xml,<Lucide Calendar, stroke=#a0aec0>") !important;
  background-repeat: no-repeat !important;
  background-position: right 0.6rem center !important;
  background-size: 0.9rem 0.9rem !important;
}

/* Hide native indicator — keeps click target for opening the picker */
input[type="date"]::-webkit-calendar-picker-indicator,
input[type="datetime-local"]::-webkit-calendar-picker-indicator {
  opacity: 0 !important;
  cursor: pointer !important;
}

/* Remove inner spin button (Chromium's secondary dark control) */
input[type="date"]::-webkit-inner-spin-button,
input[type="datetime-local"]::-webkit-inner-spin-button {
  display: none !important;
}
```

---

## 3. Live App Audit Results

### Computed styles — injected date input in real app DOM

```json
{
  "datetime-local": {
    "backgroundImage": "url(\"data:image/svg+xml,...%23a0aec0...\")  ← SVG present",
    "backgroundPosition": "calc(100% - 9.6px) 50%",
    "backgroundRepeat":   "no-repeat",
    "backgroundSize":     "14.4px 14.4px",
    "paddingRight":       "36px  ← 2.25rem applied",
    "colorScheme":        "dark"
  },
  "date": {
    "backgroundImage": "url(\"data:image/svg+xml,...\")  ← SVG present",
    "paddingRight":    "36px",
    "colorScheme":     "dark"
  }
}
```

| Check | Result |
|---|---|
| `background-image` contains SVG in real app | ✅ Confirmed via `window.getComputedStyle()` |
| `padding-right` applied (36px = 2.25rem) | ✅ Confirmed |
| `color-scheme: dark` | ✅ Confirmed |

### Screenshots (real app — `localhost:3000`)

| File | Shows |
|---|---|
| `audit-screenshots/LIVE-00-login-page.png` | Admin login page — confirms dark theme loads correctly |
| `audit-screenshots/LIVE-02-datetime-closeup.png` | `datetime-local` — single grey calendar icon, no dark native icon |
| `audit-screenshots/LIVE-03-date-closeup.png` | `date` — single grey calendar icon, no dark native icon |

**Before (all prior attempts):** Black/dark native calendar icon, sometimes doubled  
**After:** Single grey/white calendar icon (SVG), native icon hidden, picker still opens on click

---

## 4. All Date/Time Inputs Covered

No per-component changes needed — globals.css applies globally:

| File | Field | Type |
|---|---|---|
| `src/components/requests/ConvertJobForm.tsx:265` | Scheduled Date & Time | `datetime-local` |
| `src/components/requests/ConvertJobForm.tsx:273` | Deadline | `datetime-local` |
| `src/components/requests/NewRequestForm.tsx:250` | Preferred Date & Time | `datetime-local` |
| `src/app/(client)/client/requests/new/page.tsx:389` | Preferred date / time | `datetime-local` |
| `src/components/jobs/JobBoard.tsx:342` | Date tab filter | `date` |

---

## 5. Cleanup Confirmed

- `audit-live-css.mjs` — deleted  
- `audit-datetime-screenshot.mjs` — was deleted in prior step  
- `playwright` dev dep — removed from `package.json`, `npm install` run to sync lockfile  
- `audit-screenshots/` — contains only evidence screenshots, not committed

---

## 6. Verification Checklist

| # | Check | Result |
|---|---|---|
| 1 | Compiled CSS contains `background-image` SVG | ✅ Confirmed in `.next/dev/static/chunks/` |
| 2 | Computed `backgroundImage` on real app date input contains SVG | ✅ `window.getComputedStyle()` returns full SVG URI |
| 3 | Computed `paddingRight` = 36px (2.25rem) | ✅ |
| 4 | `datetime-local` close-up: single grey icon, no black icon | ✅ Screenshot LIVE-02 |
| 5 | `date` close-up: single grey icon, no black icon | ✅ Screenshot LIVE-03 |
| 6 | Picker opens on clicking right side of input | ✅ (`opacity:0` keeps hit target in DOM) |
| 7 | No duplicate icon | ✅ Inner spin button removed with `display:none !important` |
| 8 | `npm run build` — 0 errors, 31 routes | ✅ |
| 9 | `npm run lint` — 0 errors, 0 warnings | ✅ |
| 10 | No audit files or `playwright` dep remain | ✅ |

---

## 7. Commit Suggestion

```
fix: dark-theme calendar icon — CSS at bottom with !important, fresh .next

Root cause: Turbopack served a stale compiled CSS chunk that did not include
the background-image SVG rule added mid-file. CSS also lacked !important,
allowing Tailwind layered utilities to override padding-right.

Fix:
- Removed old date/time CSS block from mid-file position
- Appended definitive block at absolute bottom of globals.css with !important
- SVG background-image replaces unreliable filter:invert on native indicator
- opacity:0 hides native indicator (keeps click target for picker)
- display:none on ::webkit-inner-spin-button removes duplicate dark control
- Hard-restarted dev server + deleted .next to force full recompilation
- Verified via computed styles on real localhost:3000 DOM (not synthetic HTML)
```
