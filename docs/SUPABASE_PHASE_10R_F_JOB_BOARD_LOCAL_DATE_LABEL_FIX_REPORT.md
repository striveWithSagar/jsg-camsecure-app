# Phase 10R-F: Job Board Local Date Label Fix

**Date:** 2026-06-02  
**Status:** COMPLETE — awaiting commit approval  
**Build:** ✅ 32 routes · 0 TypeScript errors  
**Lint:** ✅ 0 errors · 0 warnings  
**No schema, RLS, or API changes.**

---

## 1. Root Cause Analysis

### The bug

The Job Board displayed the wrong date for "Today" and the wrong week for "This Week". Specifically, when the business date in **Winnipeg (CDT = UTC−5)** was June 2, the board could show June 1 as "Today" and use the wrong week boundaries.

### Why it happened — four locations

| File | Line | Bug | Timezone |
|---|---|---|---|
| `src/app/(dashboard)/jobs/page.tsx` | 6 | `todayUTC()` → `new Date().toISOString().slice(0,10)` | **UTC** ❌ |
| `src/lib/data/jobs.ts` | 166 | `getWeekStartStr()` uses `now.getUTCDay()` and `d.setUTCDate(...)` | **UTC** ❌ |
| `src/lib/data/jobs.ts` | 177–178 | `buildWeekDays()` uses `d.setUTCDate(d.getUTCDate() + i)` and `.toISOString()` | **UTC** ❌ |
| `src/components/jobs/JobBoard.tsx` | 28 | `localDateStr()` used local `getDate()` / `getMonth()` / `getFullYear()` | Local browser ✅ OK |

### Concrete failure scenario

Winnipeg CDT is UTC−5. At **11:00 PM June 1 local**:  
- UTC = **June 2, 04:00 AM**  
- `todayUTC()` returns `"2026-06-02"` → page defaults to June 2 view  
- `getWeekStartStr()` uses `getUTCDay()` → calculates UTC Monday, not Winnipeg Monday  
- `buildWeekDays()` produces UTC-based date strings → "June 2" appears in the week instead of "June 1"  
- The visible board shows the wrong day's jobs; "Today" label misplaced  

The inverse also occurs: at **midnight June 2 local** (UTC still June 1), the board would default to June 1 data and show June 1 as "Today" when the user has already crossed into June 2.

### `company_settings` timezone field

`company_settings` has no timezone column → a constant `America/Winnipeg` is used. This can be updated to read from DB settings in a future phase if needed.

---

## 2. Fix — New `businessDateKey()` Utility

### `src/lib/utils.ts` — new exports

```typescript
export const BUSINESS_TZ = "America/Winnipeg";

export function businessDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year:  "numeric",
    month: "2-digit",
    day:   "2-digit",
  }).format(date);
}
```

`en-CA` locale produces native `YYYY-MM-DD` output. `Intl.DateTimeFormat` works identically in Node.js (server) and browser (client), so the same utility works everywhere.

---

## 3. Files Changed

### `src/app/(dashboard)/jobs/page.tsx`

```diff
- import ... 
- function todayUTC(): string {
-   return new Date().toISOString().slice(0, 10);   // UTC — BUG
- }
+ import { businessDateKey } from "@/lib/utils";
  ...
- const dateParam = date ?? todayUTC();
+ const dateParam = date ?? businessDateKey();      // business TZ ✅
```

### `src/lib/data/jobs.ts`

```diff
+ import { businessDateKey, BUSINESS_TZ } from "@/lib/utils";

  function getWeekStartStr(): string {
-   const dow = now.getUTCDay();           // UTC day — BUG
-   d.setUTCDate(d.getUTCDate() + toMon);
-   d.setUTCHours(0, 0, 0, 0);
-   return d.toISOString().slice(0, 10);
+   const todayKey = businessDateKey();    // business TZ ✅
+   const d = new Date(todayKey + "T12:00:00");
+   const dow = d.getDay();
+   d.setDate(d.getDate() + toMon);
+   return businessDateKey(d);
  }

  function buildWeekDays(weekStartStr) {
-   const d = new Date(weekStartStr + "T00:00:00Z");
-   d.setUTCDate(d.getUTCDate() + i);
-   const date = d.toISOString().slice(0, 10);  // UTC — BUG
+   const d = new Date(weekStartStr + "T12:00:00"); // noon avoids DST flip
+   d.setDate(d.getDate() + i);
+   const date = businessDateKey(d);              // business TZ ✅
+   const label = d.toLocaleDateString("en-US", { ..., timeZone: BUSINESS_TZ });
  }
```

### `src/components/jobs/JobBoard.tsx`

```diff
+ import { ..., businessDateKey, BUSINESS_TZ } from "@/lib/utils";

- function localDateStr(offsetDays = 0): string {
-   const d = new Date();
-   d.setDate(d.getDate() + offsetDays);
-   return [ d.getFullYear(), ... ].join("-");   // local browser TZ (OK but inconsistent)
- }
+ function businessDateOffset(offsetDays: number): string {
+   const d = new Date();
+   if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
+   return businessDateKey(d);                   // business TZ ✅
+ }

- function fmtDayHeading(dateStr: string): string {
-   return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
-     weekday: "long", month: "long", day: "numeric",
-   });
+ function fmtDayHeading(dateStr: string): string {
+   return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
+     weekday: "long", month: "long", day: "numeric",
+     timeZone: BUSINESS_TZ,                     // consistent ✅
+   });
  }

- const todayStr    = localDateStr(0);
- const tomorrowStr = localDateStr(1);
+ const todayStr    = businessDateOffset(0);
+ const tomorrowStr = businessDateOffset(1);
```

---

## 4. Weekly Export Consistency

The weekly export button in `JobBoard` uses `bucket.selectedDate` as `weekStart`. Since `getWeekStartStr()` now returns the correct business-timezone Monday, the export week range matches the visible board week. No changes to the export logic were needed.

The DB query boundaries in `getJobsForWeeklyExport()` still use `T00:00:00+00:00` (UTC midnight) for the Supabase `timestamptz` comparisons — this is intentional and correct for DB queries.

---

## 5. Verification

### Logic proof

| Scenario | Before fix | After fix |
|---|---|---|
| June 2 00:01 AM Winnipeg (UTC June 2 05:01 AM) | Both UTC and local = June 2 ✅ | Same ✅ |
| June 1 11:00 PM Winnipeg (UTC June 2 04:00 AM) | `todayUTC()` = June 2 → board shows June 2 ❌ | `businessDateKey()` = June 1 → board shows June 1 ✅ |
| June 2 00:01 AM Winnipeg — week view | `getWeekStartStr()` used UTC Monday → could be off by one day ❌ | Uses Winnipeg Monday ✅ |
| "Today" badge in This Week | Could label wrong day if UTC week != local week ❌ | Always labels the Winnipeg date ✅ |

### Build / lint

| Check | Result |
|---|---|
| `npm run build` — 0 TypeScript errors, 32 routes | ✅ |
| `npm run lint` — 0 errors, 0 warnings | ✅ |

### Manual verification checklist (user required)

| # | Check |
|---|---|
| 🔲 1 | Open `/jobs` — "Today" tab shows the correct calendar date for your local time |
| 🔲 2 | Open `/jobs?date=week` — current week spans correct Mon–Sun for Winnipeg |
| 🔲 3 | In This Week view, "· Today" badge appears on the correct date row |
| 🔲 4 | "Tomorrow" button navigates to the correct next day |
| 🔲 5 | Weekly Export button generates report for the correct week dates |
| 🔲 6 | Test at 11:45 PM (late evening) — board still shows today's date, not tomorrow |

---

## 6. Commit Suggestion

```
fix: use business timezone (America/Winnipeg) for Job Board date labels

- utils.ts: add businessDateKey() using Intl.DateTimeFormat with BUSINESS_TZ
  constant; works identically on server (Node.js) and client (browser)
- jobs/page.tsx: replace todayUTC() (UTC) with businessDateKey()
- jobs.ts: fix getWeekStartStr() and buildWeekDays() to use business TZ
  instead of getUTCDay/setUTCDate/toISOString which used UTC midnight
- JobBoard.tsx: replace localDateStr() with businessDateOffset() backed by
  businessDateKey(); add timeZone to fmtDayHeading toLocaleDateString
- Weekly export date range unaffected (DB queries remain UTC-based)
```
