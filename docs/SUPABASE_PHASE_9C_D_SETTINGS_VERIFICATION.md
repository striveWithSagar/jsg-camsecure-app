# Phase 9C-D: Settings Page Supabase Verification

**Date:** 2026-05-27
**Project:** gbvstrhorjjvlxnfmxcz

---

## Files Under Test

| File | Role |
|---|---|
| `src/lib/data/settings.ts` | Server-side data fetcher (`getOrgSettings`) |
| `src/app/(dashboard)/settings/page.tsx` | Async Server Component |
| `src/app/(dashboard)/settings/SettingsClient.tsx` | Client component — all UI and save handlers |

---

## What Was Tested

### 1. Live Data Reads (V1)
Queried all six fields via SQL join across `organizations`, `company_settings`, and `profiles` for the admin user (`d483bbff-b30b-42b8-888f-abf91f3adf0f`).

### 2. SELECT Policies (V2)
Inspected `pg_policies` to confirm admin can read from both tables via `getOrgSettings()`.

### 3. UPDATE Policies (V3)
Inspected `pg_policies` for `organizations`, `company_settings`, and `profiles` to confirm the RLS guards match the save handlers.

### 4. Org Write Test (V4 + V5)
Mutated `company_settings.business_name`, `company_settings.invoice_footer_note`, `organizations.phone`, `organizations.address` to `[VERIFIED]` values, confirmed persistence via read-back, then restored all four columns.

### 5. Profile Write Test (V6)
Mutated `profiles.full_name` to `"JSG Admin [VERIFIED]"`, confirmed write, restored to `"JSG Admin"`.

### 6. Final State Check (V7)
Read all six fields after all restores to confirm no test pollution.

### 7. Code Inspection — Email Field
`SettingsClient.tsx:205` — `adminEmail` input has `readOnly` prop and `cursor-default` class. No `onChange` handler. No call to `supabase.auth.updateUser({ email })` anywhere in the file.

### 8. Code Inspection — Password Path
`SettingsClient.tsx:96–104` — password update guarded by `if (password.trim())`. Uses `supabase.auth.updateUser({ password })` (client-side, JWT-scoped). Password state is cleared after success (`setPassword("")`). Password value is never logged.

### 9. Code Inspection — Notifications
`SettingsClient.tsx:110–112` — `saveNotifs()` calls `toast.info("Notification delivery is not configured yet — preferences were not saved.")`. No Supabase call made.

### 10. Code Inspection — Integrations
`SettingsClient.tsx:231–234` — Supabase row configured as `{ status: "Connected", connected: true, active: true }`. This renders the "Active" badge instead of a Connect button. Stripe and Resend remain `connected: false`.

### 11. Build
`npm run build` — 0 TypeScript errors, all 25 routes compiled.

### 12. Lint
`npm run lint` — 0 ESLint errors.

---

## Results

| Check | Result | Detail |
|---|---|---|
| `company_settings.business_name` reads live | ✓ | `"JSG CamSecure"` |
| `company_settings.invoice_footer_note` reads live | ✓ | `"JSG CamSecure — Professional Security Installation"` |
| `organizations.phone` reads live | ✓ | `"555-9000"` |
| `organizations.address` reads live | ✓ | `"100 Security Blvd, Suite 200"` |
| `profiles.full_name` reads live | ✓ | `"JSG Admin"` |
| `profiles.email` reads live | ✓ | `"admin@jsg.com"` |
| SELECT policies allow admin to read org + company_settings | ✓ | `organization_id = auth_org_id()` |
| UPDATE policy allows admin to write company_settings | ✓ | `auth_role() = ANY (['owner','admin'])` |
| UPDATE policy allows admin to write organizations | ✓ | `auth_role() = ANY (['owner','admin'])` |
| UPDATE policy allows admin to write profiles (self) | ✓ | `id = auth.uid()` |
| Org write-and-restore (4 columns) | ✓ | Mutations confirmed, all columns restored |
| Profile full_name write-and-restore | ✓ | Mutation confirmed, restored to `"JSG Admin"` |
| Email field is read-only | ✓ | `readOnly` prop, no onChange, no auth email call |
| Password update path is safe | ✓ | Guarded, JWT-scoped, never logged, cleared on success |
| Notifications does not fake-save | ✓ | Honest toast only, no Supabase call |
| Supabase integration shows Connected + Active badge | ✓ | No Connect button rendered |
| Build | ✓ | 0 errors, 25 routes |
| Lint | ✓ | 0 errors |

---

## Issues Found

**None.** No code changes were made in this phase.

---

## RLS Test Limitation (noted, not a bug)

Direct SQL tests via MCP `execute_sql` run as `postgres` (`rolbypassrls=true`). `SET ROLE authenticated` does not shed session-level bypassrls, so blocking tests (technician/client cannot write) cannot be validated through this tool. Policy correctness was verified by inspection in Phase 9C-B against the same `auth_role() = ANY (...)` pattern used by the already-working `invoices`, `clients`, and `client_contacts` UPDATE policies.

---

## Phase 9C Completion Status

| Sub-phase | Description | Status |
|---|---|---|
| 9C-A | Settings audit and implementation plan | ✓ Complete |
| 9C-B | RLS migration — broaden UPDATE policies to include `admin` | ✓ Complete |
| 9C-C | Wire Settings page to Supabase | ✓ Complete |
| 9C-D | End-to-end verification | ✓ Complete |

**Phase 9C is fully complete.**
