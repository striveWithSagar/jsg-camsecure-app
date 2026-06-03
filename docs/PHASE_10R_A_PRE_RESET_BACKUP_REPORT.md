# Phase 10R-A: Pre-Reset Backup Report

**Captured:** 2026-05-30  
**Purpose:** Point-in-time record of all data that will be removed or modified in Phase 10R-B.  
**Status:** READ-ONLY — do not execute Phase 10R-B until this file is committed and approved.

> This document is the authoritative pre-deletion record. If anything goes wrong during
> Phase 10R-B, restore from this file.

---

## 1. Row Counts (Live Snapshot)

| Table | Count |
|---|---|
| `auth.users` | **9** |
| `auth.identities` | **9** |
| `profiles` | **13** |
| `organizations` | 1 |
| `company_settings` | 1 |
| `clients` | **9** |
| `client_contacts` | **9** |
| `technicians` | **6** |
| `service_requests` | **15** |
| `jobs` | **17** |
| `job_status_history` | **74** |
| `job_notes` | **2** |
| `job_photos` | **7** |
| `job_checklist_items` | 0 |
| `service_request_photos` | 0 |
| `invoices` | **7** |
| `invoice_items` | **7** |
| `notifications` | **3** |
| `email_queue` | 0 |
| `storage.objects` (camsecure-media) | **7** |

**Rows to keep after reset:** `auth.users`=1, `profiles`=1, `organizations`=1, `company_settings`=1. Everything else = 0.

---

## 2. Auth Users — To Delete (8 of 9)

The following 8 `auth.users` rows will be deleted. The one row to keep is `info@jsgcamsecure.ca`.

| # | UUID | Email | Created | Last sign-in | Reason for deletion |
|---|---|---|---|---|---|
| 1 | `c72dea1a-24b9-4b47-9f94-f45943d23e02` | sagarkarwal04@gmail.com | 2026-05-24 17:15 UTC | Never | Dev test account |
| 2 | `d483bbff-b30b-42b8-888f-abf91f3adf0f` | admin@jsg.com | 2026-05-24 17:19 UTC | 2026-05-31 00:10 UTC | Old dev admin — replaced by info@ |
| 3 | `5a8b959c-f347-4a31-8247-801356c6e5b0` | a.rivera@camsecure.com | 2026-05-26 04:23 UTC | 2026-05-31 00:11 UTC | Demo technician |
| 4 | `ae091c96-a0f0-443f-87dc-c0b5c909e9b6` | d.park@metro.com | 2026-05-26 05:26 UTC | 2026-05-31 00:11 UTC | Demo client |
| 5 | `4d4180bc-f70f-4f12-b38c-f6e6c25585b9` | sagarkarwal07@gmail.com | 2026-05-28 04:27 UTC | 2026-05-28 04:32 UTC | Dev test account |
| 6 | `ccccc001-0000-0000-0000-000000000000` | test-client-10qc@example.com | 2026-05-30 22:25 UTC | Never | Phase 10Q-C test |
| 7 | `ddddd001-0000-0000-0000-000000000000` | test-tech-10qd@example.com | 2026-05-30 22:45 UTC | Never | Phase 10Q-D test |
| 8 | `eeeee001-0000-0000-0000-000000000000` | test-client-10qe@example.com | 2026-05-30 22:56 UTC | Never | Phase 10Q-E test |

**Auth user to keep (do not touch):**

| UUID | Email | Created | Last sign-in |
|---|---|---|---|
| `2e8c5dde-16f2-498a-b292-4da05ab16e16` | info@jsgcamsecure.ca | 2026-05-30 23:20 UTC | 2026-05-30 23:24 UTC |

---

## 3. Auth Identities — To Delete (8 of 9)

One `auth.identities` row exists per `auth.users` row. All identities use `provider = email`.

| # | user_id | identity_email | Provider | Created |
|---|---|---|---|---|
| 1 | `c72dea1a-24b9-4b47-9f94-f45943d23e02` | sagarkarwal04@gmail.com | email | 2026-05-24 17:15 UTC |
| 2 | `d483bbff-b30b-42b8-888f-abf91f3adf0f` | admin@jsg.com | email | 2026-05-24 17:19 UTC |
| 3 | `5a8b959c-f347-4a31-8247-801356c6e5b0` | a.rivera@camsecure.com | email | 2026-05-26 04:23 UTC |
| 4 | `ae091c96-a0f0-443f-87dc-c0b5c909e9b6` | d.park@metro.com | email | 2026-05-26 05:26 UTC |
| 5 | `4d4180bc-f70f-4f12-b38c-f6e6c25585b9` | sagarkarwal07@gmail.com | email | 2026-05-28 04:27 UTC |
| 6 | `ccccc001-0000-0000-0000-000000000000` | test-client-10qc@example.com | email | 2026-05-30 22:25 UTC |
| 7 | `ddddd001-0000-0000-0000-000000000000` | test-tech-10qd@example.com | email | 2026-05-30 22:45 UTC |
| 8 | `eeeee001-0000-0000-0000-000000000000` | test-client-10qe@example.com | email | 2026-05-30 22:56 UTC |

---

## 4. Profiles — To Delete (12 of 13)

| # | UUID | Full name | Email | Role | is_active | Created |
|---|---|---|---|---|---|---|
| 1 | `d483bbff-b30b-42b8-888f-abf91f3adf0f` | JSG Admin | admin@jsg.com | admin | false | 2026-05-24 00:38 UTC |
| 2 | `a0000000-0000-0000-0000-000000000012` | Sam Chen | s.chen@camsecure.com | technician | true | 2026-05-24 00:38 UTC |
| 3 | `a0000000-0000-0000-0000-000000000013` | Jordan Kim | j.kim@camsecure.com | technician | true | 2026-05-24 00:38 UTC |
| 4 | `5a8b959c-f347-4a31-8247-801356c6e5b0` | Alex Rivera | a.rivera@camsecure.com | technician | true | 2026-05-24 00:38 UTC |
| 5 | `a0000000-0000-0000-0000-000000000014` | Taylor Reyes | t.reyes@camsecure.com | technician | true | 2026-05-24 00:38 UTC |
| 6 | `a0000000-0000-0000-0000-000000000015` | Morgan Davis | m.davis@camsecure.com | technician | true | 2026-05-24 00:38 UTC |
| 7 | `c72dea1a-24b9-4b47-9f94-f45943d23e02` | Sagar Karwal | sagarkarwal04@gmail.com | technician | true | 2026-05-28 04:29 UTC |
| 8 | `4d4180bc-f70f-4f12-b38c-f6e6c25585b9` | Sagar Karwal | sagarkarwal07@gmail.com | technician | true | 2026-05-28 04:31 UTC |
| 9 | `ddddd001-0000-0000-0000-000000000000` | Test Tech QD | test-tech-10qd@example.com | technician | true | 2026-05-30 22:45 UTC |
| 10 | `ae091c96-a0f0-443f-87dc-c0b5c909e9b6` | David Park | d.park@metro.com | client | true | 2026-05-26 05:27 UTC |
| 11 | `ccccc001-0000-0000-0000-000000000000` | Jane Test | test-client-10qc@example.com | client | true | 2026-05-30 22:25 UTC |
| 12 | `eeeee001-0000-0000-0000-000000000000` | Test Client QE | test-client-10qe@example.com | client | true | 2026-05-30 22:56 UTC |

**Profile to keep (do not touch):**

| UUID | Full name | Email | Role | is_active |
|---|---|---|---|---|
| `2e8c5dde-16f2-498a-b292-4da05ab16e16` | JSG Camsecure Admin | info@jsgcamsecure.ca | admin | true |

---

## 5. Storage Objects — To Delete (7 of 7)

Bucket: `camsecure-media`  
All objects are under: `org/a0000000-0000-0000-0000-000000000001/jobs/f0aaa2a8-88aa-4f6c-8071-4d5d8d1b28e7/`  
Linked to: JOB-022 (UUID `f0aaa2a8-88aa-4f6c-8071-4d5d8d1b28e7`)

**Must be deleted via Supabase Storage API — not raw SQL.**

| # | Full storage path | Size | MIME | Uploaded |
|---|---|---|---|---|
| 1 | `org/a0000000-0000-0000-0000-000000000001/jobs/f0aaa2a8-88aa-4f6c-8071-4d5d8d1b28e7/1780023547666-screenshot_2025-04-02_212813.png` | 181,881 B | image/png | 2026-05-29 02:59 UTC |
| 2 | `org/a0000000-0000-0000-0000-000000000001/jobs/f0aaa2a8-88aa-4f6c-8071-4d5d8d1b28e7/1780024143913-screenshot_2025-04-17_210348.png` | 122,899 B | image/png | 2026-05-29 03:09 UTC |
| 3 | `org/a0000000-0000-0000-0000-000000000001/jobs/f0aaa2a8-88aa-4f6c-8071-4d5d8d1b28e7/1780024153495-screenshot_2025-04-20_210134.png` | 191,241 B | image/png | 2026-05-29 03:09 UTC |
| 4 | `org/a0000000-0000-0000-0000-000000000001/jobs/f0aaa2a8-88aa-4f6c-8071-4d5d8d1b28e7/1780024158312-screenshot_2025-04-17_210348.png` | 122,899 B | image/png | 2026-05-29 03:09 UTC |
| 5 | `org/a0000000-0000-0000-0000-000000000001/jobs/f0aaa2a8-88aa-4f6c-8071-4d5d8d1b28e7/1780024167766-screenshot_2025-04-05_192701.png` | 1,993,054 B | image/png | 2026-05-29 03:09 UTC |
| 6 | `org/a0000000-0000-0000-0000-000000000001/jobs/f0aaa2a8-88aa-4f6c-8071-4d5d8d1b28e7/1780024174041-screenshot_2025-04-09_055634.png` | 72,528 B | image/png | 2026-05-29 03:09 UTC |
| 7 | `org/a0000000-0000-0000-0000-000000000001/jobs/f0aaa2a8-88aa-4f6c-8071-4d5d8d1b28e7/1780024180431-screenshot_2025-04-02_212813.png` | 181,881 B | image/png | 2026-05-29 03:09 UTC |

**Total size to reclaim: ~2.87 MB**

---

## 6. Organization Row — Before Update

The `organizations.email` field currently references the dev admin being deleted. It will be updated to `info@jsgcamsecure.ca` in Phase 10R-B.

| Field | Current value | After Phase 10R-B |
|---|---|---|
| `id` | `a0000000-0000-0000-0000-000000000001` | unchanged |
| `name` | JSG CamSecure | unchanged |
| `slug` | jsg-camsecure | unchanged |
| `email` | **admin@jsg.com** | **info@jsgcamsecure.ca** |
| `phone` | 555-9000 | unchanged |
| `address` | 100 Security Blvd, Suite 200 | unchanged |
| `logo_url` | null | unchanged |
| `created_at` | 2026-05-24 00:38:09 UTC | unchanged |
| `updated_at` | 2026-05-27 14:02:57 UTC | will update |

---

## 7. Company Settings Row — Preserved (no changes)

| Field | Value |
|---|---|
| `id` | `ad574995-f5ac-418b-a98d-38b1825ef8c0` |
| `organization_id` | `a0000000-0000-0000-0000-000000000001` |
| `business_name` | JSG CamSecure |
| `abn` | null |
| `tax_rate` | null |
| `invoice_prefix` | INV |
| `invoice_footer_note` | JSG CamSecure — Professional Security Installation |
| `primary_color` | null |
| `logo_url` | null |
| `email_alerts_enabled` | false |
| `updated_at` | 2026-05-30 18:11:45 UTC |

---

## 8. Sequences — Before Reset

| Sequence | last_value | start_value | increment_by | After reset |
|---|---|---|---|---|
| `request_number_seq` | **23** | 1 | 1 | `RESTART WITH 1` → next = 1 |
| `job_number_seq` | **24** | 1 | 1 | `RESTART WITH 1` → next = 1 |

Note: Gaps exist in both sequences from dev/test activity:
- `request_number_seq` consumed: 1–23, with gaps at 9–11, 13–14, 16–18 (used and rolled back or skipped)
- `job_number_seq` consumed: 1–24, with gaps at 15–21

After `RESTART WITH 1`, the next `INSERT` will produce `request_number = 1` and `job_number = 1`.

---

## 9. Restore Reference

If Phase 10R-B needs to be rolled back, the following IDs can be used to verify or restore:

**Auth users that must survive Phase 10R-B:**
```
2e8c5dde-16f2-498a-b292-4da05ab16e16  →  info@jsgcamsecure.ca
```

**Organization that must survive Phase 10R-B:**
```
a0000000-0000-0000-0000-000000000001  →  JSG CamSecure
```

**Profile that must survive Phase 10R-B:**
```
2e8c5dde-16f2-498a-b292-4da05ab16e16  →  JSG Camsecure Admin  (role=admin, is_active=true)
```

**Post-Phase-10R-B verification query:**
```sql
SELECT
  (SELECT COUNT(*) FROM auth.users)    = 1  AS auth_users_ok,
  (SELECT COUNT(*) FROM profiles)      = 1  AS profiles_ok,
  (SELECT COUNT(*) FROM clients)       = 0  AS clients_ok,
  (SELECT COUNT(*) FROM technicians)   = 0  AS technicians_ok,
  (SELECT COUNT(*) FROM jobs)          = 0  AS jobs_ok,
  (SELECT COUNT(*) FROM service_requests) = 0 AS requests_ok,
  (SELECT COUNT(*) FROM invoices)      = 0  AS invoices_ok,
  (SELECT COUNT(*) FROM notifications) = 0  AS notifications_ok,
  (SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'camsecure-media') = 0 AS storage_ok,
  (SELECT last_value FROM request_number_seq) = 1 AS req_seq_ok,
  (SELECT last_value FROM job_number_seq)     = 1 AS job_seq_ok,
  (SELECT email FROM auth.users WHERE id = '2e8c5dde-16f2-498a-b292-4da05ab16e16') = 'info@jsgcamsecure.ca' AS admin_intact;
```

All columns must return `true`.
