# Supabase Phase 8C-B — Technician Auth Bridge Report

> Status: COMPLETE
> Date: 2026-05-25
> Project: JSG_CamSercure (ref: gbvstrhorjjvlxnfmxcz)
> Scope: Alex Rivera (a.rivera@camsecure.com) — data bridge only, no frontend changes

---

## What Changed

The seeded Alex Rivera `profiles` row (placeholder UUID) was bridged to the real
`auth.users` row created in Supabase Dashboard. The `technicians` FK was repointed
accordingly. The placeholder profile was deleted.

No frontend code was modified. No `auth.users` or `auth.identities` rows were
written directly.

---

## Bridge Summary

| Step | Action | Result |
|---|---|---|
| 1 | `SELECT` `auth.users` for `a.rivera@camsecure.com` | Found — real UUID `5a8b959c-f347-4a31-8247-801356c6e5b0` |
| 2 | `INSERT INTO profiles` with real UUID (copy from placeholder) | ✓ |
| 3 | `UPDATE technicians SET profile_id = real_uuid` | ✓ |
| 4 | `DELETE FROM profiles WHERE id = placeholder_uuid` | ✓ |

All three steps ran inside a single `BEGIN … COMMIT` transaction.

---

## Before / After

| Entity | Before | After |
|---|---|---|
| `profiles.id` (Alex Rivera) | `a0000000-0000-0000-0000-000000000011` (placeholder) | `5a8b959c-f347-4a31-8247-801356c6e5b0` (real auth UUID) |
| `technicians.profile_id` | `a0000000-0000-0000-0000-000000000011` | `5a8b959c-f347-4a31-8247-801356c6e5b0` |
| Placeholder profile row | Exists | Deleted |
| `auth.users` row | Unchanged | Unchanged |

---

## RLS Chain Verification

| Check | Query | Result |
|---|---|---|
| `auth_role()` simulation | `SELECT role FROM profiles WHERE id = '5a8b959c-...'` | `technician` ✓ |
| `auth_technician_id()` simulation | `SELECT id FROM technicians WHERE profile_id = '5a8b959c-...'` | `a0000000-...000301` ✓ |
| Jobs visible to Alex | `SELECT … FROM jobs WHERE technician_id = 'a0000000-...000301'` | 5 jobs returned ✓ |

When Alex signs in, `auth.uid()` = `5a8b959c-f347-4a31-8247-801356c6e5b0`.
`auth_role()` → `'technician'`, `auth_technician_id()` → `a0000000-0000-0000-0000-000000000301`.
The `jobs` SELECT/UPDATE policies (`technician_id = auth_technician_id() AND auth_role() = 'technician'`)
will pass and return only Alex's jobs.

---

## Constraints Left Intact

| FK | Child Table | Delete Rule | Impact |
|---|---|---|---|
| `technicians.profile_id` | `technicians` | RESTRICT | Handled — updated before delete |
| `job_notes.author_profile_id` | `job_notes` | RESTRICT | 0 rows referenced placeholder — safe |
| `job_photos.uploaded_by_profile_id` | `job_photos` | RESTRICT | 0 rows referenced placeholder — safe |
| `job_status_history.changed_by_profile_id` | `job_status_history` | SET NULL | 0 rows referenced placeholder |
| `service_requests.submitted_by_profile_id` | `service_requests` | SET NULL | 0 rows referenced placeholder |
| `client_contacts.profile_id` | `client_contacts` | SET NULL | 0 rows referenced placeholder |

---

## What Is NOT Changed

- No frontend files touched
- No other technician profiles bridged (only Alex Rivera in this phase)
- Admin profile (`a0000000-...000010`) still a placeholder — bridged in Phase 8E when admin logs in
- Client portal mocks untouched
- `mock-session.ts` `MOCK_TECHNICIAN` still in place — removed in Phase 8C-C

---

## Recommended Next Step

**Phase 8C-C — Wire technician login page + layout to real Supabase auth, replace
`useMockStore()` on all technician portal pages with server-side Supabase queries.**

Prerequisite met: Alex Rivera's `auth.users` → `profiles` → `technicians` chain is live.
The RLS policies will enforce row-level isolation automatically on sign-in.
