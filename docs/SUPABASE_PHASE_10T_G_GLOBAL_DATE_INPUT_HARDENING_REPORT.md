# Phase 10T-G: Global Date / DateTime Input Hardening — Report

**Date:** 2026-06-05  
**Build:** ✅ 37 routes · 0 TypeScript errors  
**Lint:** ✅ 0 errors · 0 warnings

---

## 1. Audit — All Date/Datetime Inputs Found

| File | Input | Type | Before |
|---|---|---|---|
| `AnnouncementForm.tsx` | `starts-at` / `ends-at` | `date` | Local helpers, validated ✅ (Phase 10T-E) |
| `DateTimeInput` component | any | `date` / `datetime-local` | No default `min`/`max` ⚠️ |
| `ConvertJobForm.tsx` | `schedule` (required) | `datetime-local` | Presence check only — no format/range validation ⚠️ |
| `ConvertJobForm.tsx` | `deadline` (optional) | `datetime-local` | Unextracted from FormData, never validated, never saved ⚠️ |
| `NewRequestForm.tsx` | `preferred-datetime` (optional) | `datetime-local` | Not validated, not saved to DB ⚠️ |
| `client/requests/new/page.tsx` | `preferred` (optional) | `datetime-local` | Not validated, not saved to DB ⚠️ |
| `JobBoard.tsx` | date picker | `date` | Value passed raw to URL — no range validation ⚠️ |

### `.slice(0, 10)` occurrences reviewed

| Location | Usage | Safe? |
|---|---|---|
| `JobBoard.tsx:112` | `job.scheduledAt.slice(0, 10)` for overdue day-diff | ✅ DB ISO string; guarded by `validateDateTimeLocalInput` on input side |
| `JobBoard.tsx:320` | `d.toISOString().slice(0, 10)` — computed `Date` object | ✅ Always valid |
| `lib/data/jobs.ts:519` | `d.toISOString().slice(0, 10)` — computed `Date` object | ✅ Always valid |

No user-input date values pass through `.slice(0, 10)` anywhere in the codebase.

---

## 2. New Shared Helper: `src/lib/date-input.ts`

All date/datetime validation logic is now in one place. Both `AnnouncementForm` and the new form files import from this module.

### Exports

| Export | Type | Purpose |
|---|---|---|
| `MIN_DATE` | `"2024-01-01"` | Lower bound for date inputs |
| `MAX_DATE` | `"2100-12-31"` | Upper bound for date inputs |
| `MIN_DATETIME` | `"2024-01-01T00:00"` | Lower bound for datetime-local inputs |
| `MAX_DATETIME` | `"2100-12-31T23:59"` | Upper bound for datetime-local inputs |
| `toDateInputValue(iso)` | `string` | Safe YYYY-MM-DD from ISO timestamp — returns `""` for null/bad-year |
| `toDateTimeLocalInputValue(iso)` | `string` | Safe YYYY-MM-DDTHH:mm from ISO timestamp — returns `""` for null/bad-year |
| `validateDateInput(value, optional?)` | `string \| null` | Validates YYYY-MM-DD; null if blank+optional; throws on invalid |
| `validateDateTimeLocalInput(value, optional?)` | `string \| null` | Validates YYYY-MM-DDTHH:mm; null if blank+optional; throws on invalid |

The `optional` parameter defaults to `true`. When `false`, blank value throws `"Date is required."` / `"Date and time is required."` instead of returning null.

---

## 3. Files Changed

### `src/lib/date-input.ts` — NEW
Shared constants and helpers. Replaces the local duplicates that were in `AnnouncementForm.tsx`.

---

### `src/components/ui/date-time-input.tsx` — UPDATED

Added default `min`/`max` attributes derived from `type`:

```typescript
const defaultMin = type === "datetime-local" ? MIN_DATETIME :
                   type === "date"           ? MIN_DATE      : undefined;
const defaultMax = type === "datetime-local" ? MAX_DATETIME :
                   type === "date"           ? MAX_DATE      : undefined;

// Applied before {...props} so parent can override
<Input min={defaultMin} max={defaultMax} {...props} />
```

Every `DateTimeInput` with `type="date"` now has `min="2024-01-01" max="2100-12-31"` by default.  
Every `DateTimeInput` with `type="datetime-local"` now has `min="2024-01-01T00:00" max="2100-12-31T23:59"` by default.  
Callers can override by passing explicit `min`/`max` props. `type="time"` gets no defaults.

---

### `src/components/announcements/AnnouncementForm.tsx` — UPDATED

Removed local duplicates of `toDateInputValue`, `validateDateInput`, `MIN_DATE`, `MAX_DATE`.  
Now imports them from `@/lib/date-input`. Behavior is identical.

---

### `src/components/requests/ConvertJobForm.tsx` — UPDATED

**`schedule` field (required → DB):**
- Was: presence check only (`if (!schedule) ...`) — any typed string including `"11111-11-11T11:11"` passed to RPC
- Now: presence check + `validateDateTimeLocalInput(schedule, false)` — format and year range enforced before RPC call

**`deadline` field (optional → NOT saved to DB):**
- Was: `name="deadline"` in FormData but value was never read, never validated, never sent to RPC
- Now: value is extracted and validated if provided; deadline < schedule ordering check added; error display wired to JSX

> **Note:** The `deadline` field is not saved to the DB. The `convert_request_to_job` RPC has no `p_deadline` parameter, and the `jobs` table has no `deadline` column. The validation ensures the field cannot contain bad data if DB support is added later, and provides UX ordering feedback to the admin. Adding DB support would require a schema migration and is out of scope.

**Validation in `handleSubmit`:**
```typescript
// schedule (required)
if (!schedule) {
  next.schedule = "Scheduled date and time is required.";
} else {
  try { validateDateTimeLocalInput(schedule, false); }
  catch (err) { next.schedule = err.message; }
}

// deadline (optional)
if (deadlineRaw) {
  try { validateDateTimeLocalInput(deadlineRaw, true); }
  catch (err) { next.deadline = err.message; }
}

// ordering check
if (!next.schedule && !next.deadline && schedule && deadlineRaw && deadlineRaw < schedule) {
  next.deadline = "Deadline must be after the scheduled date and time.";
}
```

---

### `src/components/requests/NewRequestForm.tsx` — UPDATED

Added optional `validateDateTimeLocalInput` check for `preferred-datetime`. Invalid manual input blocks submit and shows an inline error. Blank value (field left empty) still passes.

> **Note:** The `preferred-datetime` field is not saved to the DB. The `service_requests` table has no `preferred_datetime` column. Validation prevents bad values from being submitted if the field gains a save path in the future.

---

### `src/app/(client)/client/requests/new/page.tsx` — UPDATED

Same as above for the client-portal `preferred` datetime field. Invalid input blocked at submit.

---

### `src/components/jobs/JobBoard.tsx` — UPDATED

Added validation guard in the date picker `onChange`:

```typescript
onChange={e => {
  const val = (e.target as HTMLInputElement).value;
  if (!val) return;
  try { validateDateInput(val, false); nav(val); } catch { /* ignore */ }
}}
```

A manually typed out-of-range date (e.g. `11111-11-11`) is silently ignored — the URL is not updated, the board does not navigate. The browser's native `min`/`max` attributes (now applied via `DateTimeInput` defaults) prevent the calendar picker from selecting bad dates.

---

## 4. DB Bad-Data Audit

Checked `client_announcements`, `jobs`, and `service_requests` for dates outside the 2000–2100 range:

```sql
-- client_announcements: starts_at, ends_at outside [2000, 2100]
-- jobs: scheduled_at, completed_at outside [2000, 2100]
-- service_requests: created_at, updated_at outside [2000, 2100]
```

**Result: 0 bad rows found.**

All prior bad-date rows (`"222222-02-22"` and `"111111-11-11"`) were cleaned in Phase 10T-E and 10T-F. The DB is clean.

---

## 5. Dead Code Findings (no action taken)

| Field | Form | Status |
|---|---|---|
| `preferred-datetime` | Admin `NewRequestForm` | Rendered but not saved — `service_requests` has no `preferred_datetime` column |
| `preferred` | Client `requests/new` | Rendered but not saved — same reason |
| `deadline` | `ConvertJobForm` | Rendered but not saved — `jobs` has no `deadline` column; RPC has no `p_deadline` |

All three fields are now validated at submit time to ensure they cannot carry bad data forward. Adding DB save paths would require schema migrations.

---

## 6. Verification Checklist

| Check | Expected |
|---|---|
| Type `11111-11-11` into Announcement "Show from" | Browser clamps via `min="2024-01-01"`; Save blocked: "Please enter a date between 2024 and 2100." |
| Type `11111-11-11` into ConvertJobForm schedule | Browser clamps; Save blocked: "Please enter a valid date and time between 2024 and 2100." |
| Type `11111-11-11` into ConvertJobForm deadline | Blocked: "Please enter a valid date and time between 2024 and 2100." |
| Deadline before schedule in ConvertJobForm | Blocked: "Deadline must be after the scheduled date and time." |
| Type `11111-11-11` into admin preferred-datetime | Blocked with error |
| Type `11111-11-11` into client preferred | Blocked with error |
| Type `11111-11-11` into JobBoard date picker | Silently ignored; URL not updated; board stays on current date |
| Type `222222-02-22` into any date input | Blocked at HTML level by `max`; validation catches if bypassed |
| Valid date in schedule, blank deadline | Accepted; deadline treated as null |
| Valid dates in both schedule and deadline, deadline after schedule | Accepted |
| Calendar picker — all forms | Opens via Calendar icon; restricted to 2024–2100 by `min`/`max` |
| Today / Tomorrow / This Week buttons | Unaffected — these use `businessDateOffset()` which always produces valid strings |
| Create new request (admin) | Works end-to-end |
| Create new request (client) | Works end-to-end |
| Convert request to job | Works end-to-end |
| Announcements create/edit | Works end-to-end |
| Build | ✅ 37 routes · 0 TypeScript errors |
| Lint | ✅ 0 errors · 0 warnings |

---

## 7. What Was Not Changed

- DB schema: no migrations ✅
- RLS policies: untouched ✅
- Job/request/invoice/technician workflow logic: untouched ✅
- Client portal pages other than `requests/new`: untouched ✅
- `AnnouncementForm` behavior: identical — only the import source changed ✅
- `DateTimeInput` visual appearance and picker behavior: unchanged ✅
