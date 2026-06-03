# Phase 10R-A: Zero-State Reset Plan

**Date:** 2026-05-30  
**Status:** AUDIT COMPLETE — awaiting approval for Phase 10R-B (execution)  
**Purpose:** Prepare app for client handoff — clean slate with no demo/seed/test data  
**Scope:** Audit + plan only. Nothing is deleted in this phase.

---

## 1. Desired Final State

| Item | Target |
|---|---|
| Active admin accounts | 1 — `info@jsgcamsecure.ca` only |
| Clients | 0 |
| Technicians | 0 |
| Service requests | 0 |
| Jobs | 0 |
| Invoices | 0 |
| Job photos | 0 |
| Service request photos | 0 |
| Job notes | 0 |
| Job checklist items | 0 |
| Notifications | 0 |
| Email queue rows | 0 |
| Storage objects in `camsecure-media` | 0 |
| `request_number_seq` | Reset to 1 (next request = REQ-0001) |
| `job_number_seq` | Reset to 1 (next job = JOB-0001) |

### Preserved (never touched)

| Item | Value |
|---|---|
| Organization row | `a0000000-0000-0000-0000-000000000001` — JSG CamSecure |
| `company_settings` | Unchanged |
| `info@jsgcamsecure.ca` auth user | `2e8c5dde-16f2-498a-b292-4da05ab16e16` |
| `info@jsgcamsecure.ca` profile | `2e8c5dde-16f2-498a-b292-4da05ab16e16` |
| All migrations | Untouched |
| All RLS policies | Untouched |
| All triggers and functions | Untouched |
| Storage bucket `camsecure-media` | Bucket and policies kept — only objects deleted |
| Edge Functions | Untouched |
| Environment variables | Untouched |
| All app code | Untouched |

---

## 2. Current Row Counts (Audit Snapshot — 2026-05-30)

| Table | Current rows | To delete | To keep |
|---|---|---|---|
| `auth.users` | 9 | 8 | 1 |
| `profiles` | 13 | 12 | 1 |
| `clients` | 9 | 9 | 0 |
| `client_contacts` | 9 | 9 | 0 |
| `technicians` | 6 | 6 | 0 |
| `service_requests` | 15 | 15 | 0 |
| `jobs` | 17 | 17 | 0 |
| `job_status_history` | 74 | 74 | 0 |
| `job_notes` | 2 | 2 | 0 |
| `job_photos` | 7 | 7 | 0 |
| `job_checklist_items` | 0 | 0 | 0 |
| `invoices` | 7 | 7 | 0 |
| `invoice_items` | 7 | 7 | 0 |
| `notifications` | 3 | 3 | 0 |
| `email_queue` | 0 | 0 | 0 |
| `service_request_photos` | 0 | 0 | 0 |
| `storage.objects` (camsecure-media) | 7 | 7 | 0 |

---

## 3. Auth Users — Full Inventory

| Auth UUID | Email | Created | Keep? | Reason |
|---|---|---|---|---|
| `2e8c5dde` | info@jsgcamsecure.ca | 2026-05-30 | ✅ **KEEP** | Active admin — client handoff account |
| `d483bbff` | admin@jsg.com | 2026-05-24 | ❌ Delete | Old dev admin — deactivated, replaced by `info@` |
| `5a8b959c` | a.rivera@camsecure.com | 2026-05-26 | ❌ Delete | Demo technician auth account |
| `ae091c96` | d.park@metro.com | 2026-05-26 | ❌ Delete | Demo client auth account |
| `c72dea1a` | sagarkarwal04@gmail.com | 2026-05-24 | ❌ Delete | Dev test account |
| `4d4180bc` | sagarkarwal07@gmail.com | 2026-05-28 | ❌ Delete | Dev test account |
| `ccccc001` | test-client-10qc@example.com | 2026-05-30 | ❌ Delete | Phase 10Q-C test account |
| `ddddd001` | test-tech-10qd@example.com | 2026-05-30 | ❌ Delete | Phase 10Q-D test account |
| `eeeee001` | test-client-10qe@example.com | 2026-05-30 | ❌ Delete | Phase 10Q-E test account |

**Auth users to delete: 8. Auth users to keep: 1.**

---

## 4. Profiles — Full Inventory

| Profile UUID | Full name | Email | Role | is_active | Keep? | Reason |
|---|---|---|---|---|---|---|
| `2e8c5dde` | JSG Camsecure Admin | info@jsgcamsecure.ca | admin | true | ✅ **KEEP** | Client handoff admin |
| `d483bbff` | JSG Admin | admin@jsg.com | admin | false | ❌ Delete | Old deactivated dev admin |
| `5a8b959c` | Alex Rivera | a.rivera@camsecure.com | technician | true | ❌ Delete | Demo tech with auth |
| `a0000000-…-0012` | Sam Chen | s.chen@camsecure.com | technician | true | ❌ Delete | Seed tech (no auth user) |
| `a0000000-…-0013` | Jordan Kim | j.kim@camsecure.com | technician | true | ❌ Delete | Seed tech (no auth user) |
| `a0000000-…-0014` | Taylor Reyes | t.reyes@camsecure.com | technician | true | ❌ Delete | Seed tech (no auth user) |
| `a0000000-…-0015` | Morgan Davis | m.davis@camsecure.com | technician | true | ❌ Delete | Seed tech (no auth user) |
| `c72dea1a` | Sagar Karwal | sagarkarwal04@gmail.com | technician | true | ❌ Delete | Dev test |
| `4d4180bc` | Sagar Karwal | sagarkarwal07@gmail.com | technician | true | ❌ Delete | Dev test |
| `ddddd001` | Test Tech QD | test-tech-10qd@example.com | technician | true | ❌ Delete | Phase 10Q-D test |
| `ae091c96` | David Park | d.park@metro.com | client | true | ❌ Delete | Demo client with auth |
| `ccccc001` | Jane Test | test-client-10qc@example.com | client | true | ❌ Delete | Phase 10Q-C test |
| `eeeee001` | Test Client QE | test-client-10qe@example.com | client | true | ❌ Delete | Phase 10Q-E test |

**Profiles to delete: 12. Profiles to keep: 1.**

---

## 5. Clients — Full Inventory (all delete)

| Client UUID | Name | Origin | Jobs | Invoices |
|---|---|---|---|---|
| `a0000000-…-0101` | Metro Security Ltd | Seed data | JOB-1,8,10,11,13,22 + INV-001,006,007 | Yes |
| `a0000000-…-0102` | City Bank Branch | Seed data | JOB-2 + INV-002 | Yes |
| `a0000000-…-0103` | Green Valley Mall | Seed data | JOB-3 + INV-004 | Yes |
| `a0000000-…-0104` | Harbor Logistics | Seed data | JOB-4 + INV-005 | Yes |
| `a0000000-…-0105` | Sunrise Hotel | Seed data | JOB-5 + INV-003 | Yes |
| `a0000000-…-0106` | Tech Park Office | Seed data | JOB-6,14,24 | No |
| `a0000000-…-0107` | Riverside School | Seed data | JOB-7,9 | No |
| `ccccc002` | Test Corp 10QC | Phase 10Q-C test | None | No |
| `eeeee002` | Test Client Corp 10QE | Phase 10Q-E test | None | No |

---

## 6. Technicians — Full Inventory (all delete)

| Technician UUID | Profile | Specialty | Has auth user | Jobs assigned |
|---|---|---|---|---|
| `a0000000-…-0301` | Alex Rivera | Installation & Networking | ✅ Yes | JOB-1,5,10,14 |
| `a0000000-…-0302` | Sam Chen | DVR/NVR Systems | ❌ No | JOB-2,6,11,13 |
| `a0000000-…-0303` | Jordan Kim | CCTV & IP Cameras | ❌ No | JOB-3,22 |
| `a0000000-…-0304` | Taylor Reyes | Access Control | ❌ No | JOB-4,12 |
| `a0000000-…-0305` | Morgan Davis | Wiring & Cabling | ❌ No | JOB-7,9,23,24 |
| `ddddd002` | Test Tech QD | Security Systems | ✅ Yes | None |

---

## 7. Service Requests — Full Inventory (all delete)

| Request # | Client name | Status | Origin |
|---|---|---|---|
| REQ-001 | Lakeside Clinic | converted | Seed |
| REQ-002 | Sunrise Retail | converted | Seed |
| REQ-003 | Parkview Condos | ready_to_schedule | Seed |
| REQ-004 | First National Bank | reviewing | Seed |
| REQ-005 | Apex Tower Management | new | Seed |
| REQ-006 | ABC | new | Dev test |
| REQ-007 | Sagar | new | Dev test |
| REQ-008 | Metro Security Ltd | new | Dev test |
| REQ-012 | strive | converted | Dev test |
| REQ-015 | 11111111111 | converted | Dev test |
| REQ-019 | Metro Security Ltd | cancelled | Dev test |
| REQ-020 | Metro Security Ltd | cancelled | Dev test |
| REQ-021 | Metro Security Ltd | cancelled | Dev test |
| REQ-022 | Metro Security Ltd | cancelled | Dev test |
| REQ-023 | immigrration | converted | Dev test |

Note: `request_number_seq` last_value = **23**. Gaps (9–11, 13–14, 16–18) were consumed during testing.

---

## 8. Jobs — Full Inventory (all delete)

| Job # | UUID prefix | Status | Client | Technician | Photos | Notes | Invoices |
|---|---|---|---|---|---|---|---|
| JOB-001 | `a0000000-…-0501` | in_progress | Metro Security | Alex Rivera | 0 | 0 | INV-007 |
| JOB-002 | `a0000000-…-0502` | cancelled | City Bank | Sam Chen | 0 | 0 | INV-002 |
| JOB-003 | `a0000000-…-0503` | cancelled | Green Valley | Jordan Kim | 0 | 0 | INV-004 |
| JOB-004 | `a0000000-…-0504` | cancelled | Harbor Logistics | Taylor Reyes | 0 | 0 | INV-005 |
| JOB-005 | `a0000000-…-0505` | completed | Sunrise Hotel | Alex Rivera | 0 | 0 | INV-003 |
| JOB-006 | `a0000000-…-0506` | completed | Tech Park | Sam Chen | 0 | 0 | 0 |
| JOB-007 | `a0000000-…-0507` | cancelled | Riverside School | Morgan Davis | 0 | 0 | 0 |
| JOB-008 | `a0000000-…-0508` | cancelled | Metro Security | Alex Rivera | 0 | 0 | 0 |
| JOB-009 | `a0000000-…-0509` | cancelled | Riverside School | Alex Rivera | 0 | 0 | 0 |
| JOB-010 | `a0000000-…-0510` | completed | Metro Security | Alex Rivera | 0 | 0 | INV-001 |
| JOB-011 | `a0000000-…-0511` | cancelled | Metro Security | Sam Chen | 0 | 0 | 0 |
| JOB-012 | `a0000000-…-0512` | cancelled | Metro Security | Taylor Reyes | 0 | 1 | 0 |
| JOB-013 | `a0000000-…-0513` | completed | Metro Security | Sam Chen | 0 | 0 | INV-006 |
| JOB-014 | `53f2b7b0` | completed | Tech Park | Sam Chen | 0 | 1 | 0 |
| JOB-022 | `f0aaa2a8` | assigned | Metro Security | Jordan Kim | **7** | 0 | 0 |
| JOB-023 | `aa36eb95` | cancelled | Metro Security | Morgan Davis | 0 | 0 | 0 |
| JOB-024 | `7106cb91` | completed | Tech Park | Morgan Davis | 0 | 0 | 0 |

Note: `job_number_seq` last_value = **24**. Gaps (15–21) consumed during testing.

---

## 9. Storage Objects — Full Inventory (all delete)

All 7 objects are under a single job folder. **Must be deleted via Supabase Storage API — not SQL.**

| Storage path | Size | Linked job |
|---|---|---|
| `org/a0000000-…-0001/jobs/f0aaa2a8-…/1780023547666-screenshot_2025-04-02_212813.png` | 177 KB | JOB-022 |
| `org/a0000000-…-0001/jobs/f0aaa2a8-…/1780024143913-screenshot_2025-04-17_210348.png` | 120 KB | JOB-022 |
| `org/a0000000-…-0001/jobs/f0aaa2a8-…/1780024153495-screenshot_2025-04-20_210134.png` | 187 KB | JOB-022 |
| `org/a0000000-…-0001/jobs/f0aaa2a8-…/1780024158312-screenshot_2025-04-17_210348.png` | 120 KB | JOB-022 |
| `org/a0000000-…-0001/jobs/f0aaa2a8-…/1780024167766-screenshot_2025-04-05_192701.png` | 1.9 MB | JOB-022 |
| `org/a0000000-…-0001/jobs/f0aaa2a8-…/1780024174041-screenshot_2025-04-09_055634.png` | 71 KB | JOB-022 |
| `org/a0000000-…-0001/jobs/f0aaa2a8-…/1780024180431-screenshot_2025-04-02_212813.png` | 177 KB | JOB-022 |

**Total storage to reclaim: ~2.9 MB**

Why Storage API not SQL: `storage.objects` rows are managed by Supabase Storage internally. Deleting via `DELETE FROM storage.objects` bypasses the CDN cache invalidation and object lifecycle hooks. The correct method is `storage.from('camsecure-media').remove([...paths])` or the Supabase Dashboard → Storage → delete objects.

---

## 10. Dependency Map (Delete Order)

The following order respects all foreign key constraints. Child rows must be deleted before parents.

```
Step 1 — Storage API
  storage.objects (camsecure-media) — 7 objects
  → Must happen before job_photos rows (otherwise orphan CDN cache)

Step 2 — Deepest children
  invoice_items         (FK → invoices)                    7 rows
  job_checklist_items   (FK → jobs)                        0 rows
  job_photos            (FK → jobs, uploaded_by_profile_id) 7 rows
  job_notes             (FK → jobs, job_id)                2 rows
  job_status_history    (FK → jobs, job_id)                74 rows
  service_request_photos (FK → service_requests)           0 rows

Step 3 — Mid-level
  invoices              (FK → clients, jobs)               7 rows
  jobs                  (FK → clients, technicians,
                              service_requests)             17 rows

Step 4 — Service requests
  service_requests      (FK → organization)                15 rows

Step 5 — Notifications, email_queue
  notifications                                            3 rows
  email_queue                                              0 rows

Step 6 — Client/technician links
  client_contacts       (FK → clients, profiles)           9 rows
  technicians           (FK → profiles)                    6 rows

Step 7 — Clients
  clients               (FK → organization)                9 rows

Step 8 — Profiles (client/technician/old-admin only)
  profiles WHERE id != '2e8c5dde-…'                       12 rows

Step 9 — Auth identities (must precede auth.users delete)
  auth.identities WHERE user_id IN (8 UUIDs)

Step 10 — Auth users
  auth.users WHERE id != '2e8c5dde-…'                     8 rows

Step 11 — Reset sequences
  ALTER SEQUENCE request_number_seq RESTART WITH 1;
  ALTER SEQUENCE job_number_seq RESTART WITH 1;
```

---

## 11. Sequences / Counters

| Sequence | Current last_value | After reset |
|---|---|---|
| `request_number_seq` | 23 | 1 (next request = REQ-0001) |
| `job_number_seq` | 24 | 1 (next job = JOB-0001) |

Both sequences use `increment_by = 1`, `start_value = 1`. A simple `RESTART WITH 1` is safe once all rows using these numbers are deleted.

---

## 12. One Additional Fix — Organization Contact Email

The `organizations` row currently has `email = 'admin@jsg.com'` — the old dev admin account that is being deleted. This should be updated to `info@jsgcamsecure.ca` as part of Phase 10R-B.

| Field | Current value | After reset |
|---|---|---|
| `organizations.email` | admin@jsg.com | info@jsgcamsecure.ca |

---

## 13. Confirmed Not Affected

| Item | Status |
|---|---|
| `organizations` table row | Preserved — only `email` field updated |
| `company_settings` | Preserved — no changes |
| Storage bucket `camsecure-media` | Preserved — only objects deleted |
| Storage policies on `camsecure-media` | Preserved |
| All RLS policies | Preserved |
| All triggers (`trg_job_status_on_insert`, etc.) | Preserved |
| All functions | Preserved |
| All migrations | Preserved |
| Edge Functions | Preserved |
| `service_request_photos` table | Already empty — 0 rows |
| `job_checklist_items` table | Already empty — 0 rows |
| `email_queue` table | Already empty — 0 rows |

---

## 14. Expected Final State After Phase 10R-B

```sql
-- Expected query results after cleanup:
SELECT COUNT(*) FROM auth.users;                        -- 1
SELECT COUNT(*) FROM profiles;                          -- 1
SELECT COUNT(*) FROM clients;                           -- 0
SELECT COUNT(*) FROM client_contacts;                   -- 0
SELECT COUNT(*) FROM technicians;                       -- 0
SELECT COUNT(*) FROM service_requests;                  -- 0
SELECT COUNT(*) FROM jobs;                              -- 0
SELECT COUNT(*) FROM job_status_history;                -- 0
SELECT COUNT(*) FROM job_notes;                         -- 0
SELECT COUNT(*) FROM job_photos;                        -- 0
SELECT COUNT(*) FROM job_checklist_items;               -- 0
SELECT COUNT(*) FROM invoices;                          -- 0
SELECT COUNT(*) FROM invoice_items;                     -- 0
SELECT COUNT(*) FROM notifications;                     -- 0
SELECT COUNT(*) FROM email_queue;                       -- 0
SELECT COUNT(*) FROM storage.objects
  WHERE bucket_id = 'camsecure-media';                  -- 0
SELECT last_value FROM request_number_seq;              -- 1
SELECT last_value FROM job_number_seq;                  -- 1
SELECT email FROM organizations
  WHERE id = 'a0000000-0000-0000-0000-000000000001';   -- info@jsgcamsecure.ca
```

Admin login at `/login/admin`:
- `info@jsgcamsecure.ca` → dashboard shows empty state
- "Add Client" → works
- "Add Technician" → works
- No demo clients, technicians, requests, or jobs visible
- NotificationBell shows 0 unread

---

## 15. Phase 10R-B Execution Checklist

When approved, Phase 10R-B will execute the following in order:

- [ ] Delete 7 storage objects via Supabase Storage API (`storage.remove()`)
- [ ] Verify 0 objects remain in `storage.objects`
- [ ] Delete `invoice_items`, `job_checklist_items`, `job_photos`, `job_notes`, `job_status_history`, `service_request_photos`
- [ ] Delete `invoices`, `jobs`
- [ ] Delete `service_requests`
- [ ] Delete `notifications`, `email_queue`
- [ ] Delete `client_contacts`, `technicians`
- [ ] Delete `clients`
- [ ] Delete `profiles` WHERE id != `2e8c5dde-…`
- [ ] Delete `auth.identities` for 8 removed users
- [ ] Delete `auth.users` WHERE id != `2e8c5dde-…`
- [ ] `ALTER SEQUENCE request_number_seq RESTART WITH 1`
- [ ] `ALTER SEQUENCE job_number_seq RESTART WITH 1`
- [ ] `UPDATE organizations SET email = 'info@jsgcamsecure.ca' WHERE id = 'a0000000-…-0001'`
- [ ] Run verification SQL (all counts = 0 except auth.users=1, profiles=1)
- [ ] Log in as `info@jsgcamsecure.ca` and confirm empty dashboard
- [ ] Run `npm run build` and `npm run lint`

**Do not proceed until this plan is approved.**
