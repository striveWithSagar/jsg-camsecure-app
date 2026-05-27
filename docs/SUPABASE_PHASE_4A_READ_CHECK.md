# Supabase Phase 4A — Read Check Report

> Status: COMPLETE
> Date: 2026-05-23
> Project: JSG_CamSercure (ref: gbvstrhorjjvlxnfmxcz)
> Scope: Read-only feasibility check for service_requests. No UI changed.

---

## A. Can service_requests be read from the app right now?

**No.** App-level reads return **0 rows** (not an error).

The database has 5 service_request rows confirmed present. The Supabase client
is correctly configured with the publishable key. The query itself is valid.
The reason reads return empty is RLS — see section B.

---

## B. Does RLS block reads without auth?

**Yes — definitively.**

The `service_requests_select` policy in `20260523120000_create_base_schema.sql`:

```sql
create policy "service_requests_select"
  on service_requests for select
  to authenticated
  using (
    (organization_id = auth_org_id() and auth_role() in ('owner', 'admin', 'dispatcher'))
    or
    (client_id = auth_client_id() and auth_role() = 'client')
  );
```

Evidence chain:
1. `to authenticated` — this policy applies only to the Supabase `authenticated`
   role (JWT-verified sessions). Anonymous/publishable key requests use the
   `anon` role, which has no SELECT policy on this table.
2. No `anon`-role policy exists anywhere in the migration (confirmed: zero
   `"to anon"` occurrences in the schema file).
3. Even if the anon role could reach the USING clause, `auth_org_id()` calls
   `auth.uid()` which returns NULL without a session, making
   `organization_id = NULL` always false in Postgres.
4. With RLS enabled and no matching policy, Postgres returns 0 rows silently —
   no error, just empty results.

**RLS was not weakened.** No new policies were added. No unsafe public read was
created.

---

## C. Must auth be implemented before frontend replacement?

**Yes.** The /requests page cannot be migrated from mock-store to Supabase
reads until Phase 8 creates real auth.users rows and the app can establish a
JWT session. Without a session:

- `auth.uid()` → NULL
- `auth_org_id()` → NULL
- All RLS USING clauses → false
- Every table → 0 rows returned

Attempting to replace the /requests page now would render an empty table to the
user. The mock-store must remain the data source until auth is in place.

---

## D. Files Changed

| File | Change |
|---|---|
| `src/lib/data/service-requests.ts` | Created — read-only data access layer |
| `docs/SUPABASE_PHASE_4A_READ_CHECK.md` | Created (this file) |

No `src/app/` routes modified. No mock-store touched. No UI changed.
No RLS policies added or modified. No auth.users created.

---

## E. Data Helper Functions Created

**File:** `src/lib/data/service-requests.ts`

### Types exported

| Type | Description |
|---|---|
| `RequestStatus` | `"new" \| "reviewing" \| "ready_to_schedule" \| "converted" \| "cancelled"` |
| `UrgencyLevel` | `"emergency" \| "high" \| "medium" \| "low"` |
| `ServiceType` | 10-value enum matching `service_type` Postgres enum |
| `ServiceRequest` | Full DB row type — all 15 columns, nullability matches schema |

### Functions exported

| Function | Signature | Returns |
|---|---|---|
| `getServiceRequests` | `() => Promise<ServiceRequest[]>` | All rows for the authed org, ordered by `created_at DESC`. Returns `[]` on error or no auth. |
| `getServiceRequestById` | `(id: string) => Promise<ServiceRequest \| null>` | Single row or null. PGRST116 (no row) is silently handled; other errors are logged. |

Both functions:
- Use the server Supabase client (publishable key + session cookies)
- Are read-only — no INSERT, UPDATE, DELETE
- Return empty/null gracefully when RLS blocks access
- Log unexpected errors via `console.error` with function name prefix

### How ServiceRequest maps to MockRequestItem

When Phase 4A-B replaces the /requests page, the mapping will be:

| MockRequestItem field | ServiceRequest field |
|---|---|
| `id` | `id` |
| `client` | `client_name` |
| `phone` | `client_phone` |
| `type` | `service_type` |
| `urgency` | `urgency` |
| `status` | `status` |
| `created` | `created_at` (formatted) |
| `description` | `description` |
| `notes` | `notes` |

No data is lost. `ServiceRequest` is a superset of `MockRequestItem` — it
additionally carries `organization_id`, `client_id`, `converted_to_job_id`,
`updated_at`, and the FK columns.

---

## F. Build Result

✓ Clean — no TypeScript errors. All 22 routes compiled successfully.

---

## G. Lint Result

✓ Clean — no ESLint errors or warnings.

---

## Recommended Next Step

**Phase 8 — Implement Auth (prerequisite for all Supabase frontend reads)**

Auth must be in place before any page can replace its mock-store read with a
Supabase query. This is the blocker for Phase 4A-B and all subsequent frontend
migration phases.

Phase 8 requires:
1. Create real `auth.users` rows in Supabase (email/password or OAuth)
2. Update `profiles` rows to match the real `auth.users.id` values
3. Implement sign-in flow in the Next.js app (Supabase Auth UI or custom form)
4. Add middleware to refresh the session cookie (`@supabase/ssr` middleware pattern)

Once a session cookie is present in requests, `auth.uid()` returns a real UUID,
`auth_org_id()` resolves to the org, and all 43 RLS policies begin functioning
as designed.

After Phase 8, **Phase 4A-B** can proceed: replace `/requests` page's
`useMockStore().requests` read with a call to `getServiceRequests()` from
`src/lib/data/service-requests.ts`.

---

## Summary

| Question | Answer |
|---|---|
| Can app read service_requests now? | No — 0 rows returned |
| Does RLS block reads? | Yes — `to authenticated` policy, no `anon` policy |
| Is auth required before replacement? | Yes — mandatory prerequisite |
| Were any RLS policies weakened? | No |
| Were any auth.users created? | No |
| Was the /requests UI changed? | No |
| Is mock-store still active? | Yes — unchanged |
