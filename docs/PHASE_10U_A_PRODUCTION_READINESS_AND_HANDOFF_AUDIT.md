# Phase 10U-A: Production Readiness and Client Handoff Audit

**Date:** 2026-06-07
**Scope:** Read-only audit. No schema changes, no data deletion, no commits.
**Build:** ✅ 38 routes · 0 TypeScript errors
**Lint:** ✅ 0 errors · 0 warnings

---

## 1. Deployment

| Check | Result |
|---|---|
| Latest `main` commit | `1968f4f` "feat: implement functional global admin search" (pushed 2026-06-07 11:13:56 -0500) |
| Vercel production deployment | `dpl_J3SCSWvAivWAdGuAZ36q6zbbS4J5`, **created 2026-06-07 11:13:54 -0500 — 2 seconds before the commit timestamp** (git-integration auto-deploy), status **● Ready** |
| Production reachable | ✅ `https://jsg-camsecure-app.vercel.app/` → HTTP 200 |
| `/api/admin/search` exists & guarded | ✅ `GET /api/admin/search?q=test` (unauthenticated) → **HTTP 401** `{"error":"Not authenticated"}` — this exact JSON string only exists in the code added by commit `1968f4f` (`route.ts:13`), which **fingerprints the deployed bundle as containing the latest commit** |
| PWA manifest live | ✅ `/manifest.webmanifest` → HTTP 200 |

**Verdict: Deployment is current and matches `origin/main`.** ✅

---

## 2. Full Workflow Test (code-path verification — see §2 note on method)

| # | Step | File:line | Result |
|---|---|---|---|
| 1 | Client creates request with preferred date/time | `NewRequestForm.tsx:115` saves `preferred_at`; `service-requests.ts:42` types it | ✅ |
| 2 | Admin sees preferred date/time | `RequestDetail.tsx:155-160` renders "Preferred Date & Time" | ✅ |
| 3 | Admin converts request → job | `convert_request_to_job` RPC (`20260530000001_notifications.sql:195`), invoked from `ConvertJobForm.tsx:123` | ✅ |
| 4 | Scheduled time pre-fills from preferred | `ConvertJobForm.tsx:34,297` — `defaultValue={toDateTimeLocalInputValue(request.preferredAt)}` | ✅ |
| 5 | Admin adds deadline | `ConvertJobForm.tsx:135-138` — direct `UPDATE jobs SET deadline_at = …` after conversion | ✅ |
| 6 | Technician receives assignment notification | RPC inserts `admin_technician_assigned` notification → `v_tech_profile` (`notifications.sql:248-252`) | ✅ |
| 7 | Technician sees client name, address, deadline | `TechJobDetail.tsx:35` (`job.client`), `:48` (Address), `:47,97-100` (Deadline) | ✅ |
| 8 | Technician updates status | `JobStatusWidget.tsx:58-59` → `supabase.from("jobs").update(...)`, fires `trg_job_status_change` trigger | ✅ |
| 9 | Admin receives status notification | `fn_record_job_status_change()` inserts `technician_job_status_changed`/`technician_job_completed` for `recipient_role: 'admin'` (`notifications.sql:127-134`) | ✅ |
| 10 | Client sees request/job update | `fn_record_job_status_change()` → `job_completed_client` (`:144-149`); `fn_sr_status_client_notify()` → `request_status_updated_client` (`:172-178`); rendered in `(client)/client/jobs/[id]/page.tsx:64-65,102,111` and `NotificationBell.tsx:59-60` | ✅ |
| 11 | Weekly Excel export includes Client Preferred + Deadline | `weekly/route.ts:140,142` columns `"Client Preferred"` (`preferred_at`) and `"Deadline"` (`deadline_at`); populated at `:178,180` | ✅ |

**Verdict: All 11 steps are wired correctly end-to-end.** ✅

> **Method note:** This environment has no browser-automation tool (confirmed via `ToolSearch` in the prior phase — no Playwright/devtools tool available). The workflow was therefore verified by **reading the actual implementation** — server actions, the `convert_request_to_job` RPC, the two notification trigger functions (`fn_record_job_status_change`, `fn_sr_status_client_notify`), and the rendering components/queries that consume each piece of data — rather than clicking through the UI. Live notification volumes in the database (below) corroborate that these paths have actually fired in practice, not just that the code exists.
>
> | event_type | rows | read | first seen | last seen |
> |---|---|---|---|---|
> | `technician_job_status_changed` | 34 | 34 | 2026-05-31 | 2026-06-03 |
> | `request_converted_to_job` | 23 | 11 | 2026-05-31 | 2026-06-07 |
> | `admin_technician_assigned` | 15 | 3 | 2026-05-30 | 2026-06-07 |
> | `job_completed_client` | 11 | 1 | 2026-06-01 | 2026-06-06 |
> | `technician_job_completed` | 4 | 4 | 2026-05-31 | 2026-06-03 |
> | `request_status_updated_client` | 1 | 0 | 2026-06-03 | 2026-06-03 |
>
> Recommend a final live click-through (client → admin → technician → admin → client → export) before go-live, since this confirms the *paths exist and have fired*, not that today's exact data renders pixel-perfect in the browser.

---

## 3. User / Account Audit

### Active admins/owners
| Name | Email | Role | Active |
|---|---|---|---|
| JSG Camsecure Admin | `info@jsgcamsecure.ca` | admin | ✅ active |
| JSG Admin | `admin@jsg.com` | admin | ❌ inactive (seed account) |

No `owner` or `dispatcher` accounts currently exist — only the `admin` role is in use.

### Active technicians (5)
| Name | Email | Specialty | Status |
|---|---|---|---|
| Abhi | abhijeetsingh2623@gmail.com | Security Camera, Alarm, Audio and Access Control | available |
| Gaurav | gaurav@gmail.com | "lazy" *(test value)* | available |
| Jaskaran_Technician | jaskarantechnician3@gmail.com | — | available |
| Sam Chen | s.chen@camsecure.com | DVR/NVR Systems | on_the_way |
| Vinay | vinay@gmail.com | — | available |

### Deactivated technicians (5)
| Name | Email | Reason (inferred) |
|---|---|---|
| Alex Rivera | a.rivera@camsecure.com | Seed/demo technician (created 2026-05-24) |
| Jordan Kim | j.kim@camsecure.com | Seed/demo technician |
| Morgan Davis | m.davis@camsecure.com | Seed/demo technician |
| Taylor Reyes | t.reyes@camsecure.com | Seed/demo technician |
| Test Tech QD | test-tech-10qd@example.com | Explicit test account (Phase 10QD) |

### Clients (12)
6 seed/demo clients (Metro Security Ltd, City Bank Branch, Green Valley Mall, Harbor Logistics, Sunrise Hotel [inactive], Tech Park Office, Riverside School), plus 6 created during live testing (Test Corp 10QC, Test Client Corp 10QE, Norbert Company, Rahon (2 June), Ropar(3)) — see cleanup table in §4 for per-row recommendations.

### Inactive technicians — UI/assignment confirmation
| Check | Result | Evidence |
|---|---|---|
| Excluded from Dashboard Field Crew | ✅ | `dashboard.ts:114` — `.eq("is_active", true)` on the crew query |
| Excluded from assignment dropdowns | ✅ | `technicians.ts:106` — `getTechnicians()` (used by Convert-to-Job and Reassign) filters `.eq("is_active", true)` |

(Both filters were added/confirmed in Phase 10T-I and remain in place — re-verified by direct grep against current `main`.)

---

## 4. Data Cleanup Recommendation

**Nothing was deleted or modified.** This is a recommendation table for your review.

| Entity | Item | Recommendation | Why |
|---|---|---|---|
| Admin | `admin@jsg.com` (JSG Admin, inactive) | **Archive/Delete** | Seed admin account, already deactivated; real admin is `info@jsgcamsecure.ca` |
| Organization | `organizations.email = admin@jsg.com` | **Needs user decision** | The org's contact email is still the seed placeholder, not `info@jsgcamsecure.ca` — likely shown to clients/on invoices |
| Technicians | Alex Rivera, Jordan Kim, Morgan Davis, Taylor Reyes (deactivated, `@camsecure.com` seed emails) | **Archive/Delete** | Seed/demo technicians, already deactivated, have historical job links (deleting would orphan `jobs.technician_id` / `job_status_history` — archiving is safer than deleting) |
| Technicians | Test Tech QD (`test-tech-10qd@example.com`) | **Delete** | Explicit test account from Phase 10QD, no real-world meaning |
| Technicians | Gaurav (specialty = "lazy"), Vinay, Jaskaran_Technician (gmail.com addresses, created during live testing 2026-05-31 to 2026-06-03) | **Needs user decision** | Could be real new hires using personal email, or could be test accounts created while exploring the app — only you can tell which |
| Clients | Metro Security Ltd, City Bank Branch, Green Valley Mall, Harbor Logistics, Sunrise Hotel, Tech Park Office, Riverside School (seed data, created 2026-05-24) | **Needs user decision** | These are the original seed/demo clients with realistic-looking data — keep if you intend to use them as real client records, archive/delete if purely demo |
| Clients | Test Corp 10QC, Test Client Corp 10QE | **Delete** | Explicitly named test clients from Phase 10QC/10QE |
| Clients | Norbert Company, Rahon (2 June), Ropar(3) | **Delete** | Created during live exploratory testing (gibberish addresses like "Rahon(Address)", contact emails like `rahon@gmail.com`/`ropar@gmail.com`, request descriptions in mixed Punjabi/English test phrases e.g. "bhaji hal kro sada rahon ch...") |
| Service Requests | REQ-0023 ("immigrration"/"canadian pathway"), REQ-0019/0020 ("Updated: Phase 10O-C test — camera 2 offline"), all requests tied to Norbert Company / Rahon / Ropar (REQ-0024–0035, ~14 requests) | **Delete** | Test/exploratory content — gibberish descriptions, explicit "Phase 10O-C test" markers, non-business languages mixed in |
| Jobs | JOB-0028–0031, 0036, 0037 ("jalandhar, punjab, india", "rahon, punjab, india", "ropar, punjab, india", "downtown winnipeg", "ll", site name "67 Haverhill Crescent" duplicated 3×) and JOB-0014/0007/0022-0024 (seed jobs) | **Delete (test) / Keep (seed, pending decision)** | The Punjab/India/"ll"/"downtown winnipeg" jobs (11 of 31 total) are clearly created during live testing — converted from the test requests above. The original 13 seed jobs (job_number 1–13ish from the May 24 seed migration) can stay if you want a populated demo, or be cleared for a clean handoff |
| Announcements | "New Deal", "test 2", "deal test 1", "testdeal" (all `is_published = false`) | **Delete** | Explicit test titles/descriptions ("Deal Deal Deal", "tstingggg"), unpublished |
| Announcements | "Chk do fte" / "Ssa" (`is_published = TRUE`, live 2026-06-06 to 2026-06-08) | **⚠️ Needs urgent user decision** | **This is currently LIVE and visible to clients** but reads as test/gibberish content ("Chk do fte" / "Ssa"). Recommend unpublishing or replacing before handoff — see Production Blockers |
| Announcements | "Summer is here" / "Ajo sare" (`is_published = TRUE`) | **Needs user decision** | Published and structurally fine, but "Ajo sare" is Punjabi, not matching the English business copy elsewhere — confirm this is intentional bilingual content vs. a placeholder |
| Notifications | 91 total rows, mostly tied to the test entities above (`request_converted_to_job`, `admin_technician_assigned`, `technician_job_status_changed`, etc.) | **Archive/Delete (cascades with source data)** | Will naturally clean up if/when the underlying test jobs/requests/technicians are removed — no separate action needed |
| Photos/Notes/Checklists | 11 job photos, 7 request photos, 8 job notes, 8 checklist items | **Needs user decision** | Likely tied 1:1 with the jobs/requests above — review alongside those decisions; storage objects (not just DB rows) would also need cleanup if deleted |
| Invoices | 7 invoices (from original seed, tied to seed jobs/clients) | **Keep** | Appear to be the original realistic seed data; financial records — recommend keeping unless you want a totally blank ledger for handoff |

**Summary recommendation:** There is a clear line between (a) the **original seed dataset** (May 24, realistic-looking demo data — Metro Security, City Bank, Sam Chen, Alex Rivera, etc.) and (b) **live exploratory-testing data** created May 30 – June 7 (Norbert Company, Rahon, Ropar, Test Corp/Client/Tech, Punjab/India job sites, "Phase 10O-C test" markers, gibberish announcement copy). Group (b) is unambiguously safe to delete. Group (a) is a judgment call — keep it as a working demo, or clear it for a completely blank production handoff.

---

## 5. Security Audit

| Check | Result |
|---|---|
| RLS enabled on main tables | ✅ Confirmed live: `jobs`, `service_requests`, `clients`, `client_contacts`, `technicians`, `profiles` all have `relrowsecurity = true` with `organization_id = auth_org_id()`-scoped policies (inspected `pg_policies` directly) |
| Service-role key is server-only | ✅ `createServiceRoleClient()` (`service-role.ts`) is imported only by `api/admin/accounts/route.ts` and `api/auth/request-password-help/route.ts` — both server-side route handlers; the file's own doc-comment warns "NEVER import into a client component"; grep across `src/` confirms only these 2 importers |
| No env files committed | ✅ `git ls-files` shows no `.env*` tracked; `.gitignore` covers `.env*`; only `src/lib/supabase/service-role.ts` matched a "service_role" filename grep (it's source code referencing the env var *name*, not the secret) |
| Admin-only routes reject unauthenticated access | ✅ All 3 admin API routes (`accounts`, `reports/jobs/weekly`, `search`) call `auth.getUser()` first and return 401 if no session, then check `profile.role` and return 403 if not admin/owner(/dispatcher for search). Confirmed live: production `GET /api/admin/search` → 401 |
| Client cannot access admin/technician routes | ✅ Each portal's route-group layout (`(dashboard)/layout.tsx:12`, `(technician)/layout.tsx:10`, `(client)/layout.tsx` via `getCurrentClientProfile` which returns `null` unless `role === 'client'`) performs a server-side role check and `redirect()`s before rendering — a client session hitting `/dashboard` or `/technician` is bounced to the matching login page server-side, before any data loads |

**No security blockers found.** ✅

---

## 6. Production Readiness

| Item | Status | Notes |
|---|---|---|
| Company settings | ⚠️ Partially complete | `business_name = "JSG CamSecure"`, `invoice_prefix = "INV"` set; **`abn`, `tax_rate`, `primary_color`, `logo_url` are all NULL** — invoices will show no tax line and no custom branding color/logo until these are filled in |
| Organization contact info | ⚠️ Stale | `organizations.email = "admin@jsg.com"` — the seed placeholder, not the real business email `info@jsgcamsecure.ca` (this is what clients/invoices may show as the company contact) |
| Google review URL | ✅ Set | `https://share.google/oUog5JNnrv9slovfN` — present in `company_settings.google_review_url` |
| Announcements | ⚠️ See §4 | 6 total: 4 unpublished test entries (safe), but **2 published announcements are currently live**, one of which ("Chk do fte" / "Ssa") reads as test gibberish — needs review before handoff |
| PWA manifest/icons | ✅ Complete | `src/app/manifest.ts` generates the manifest; `public/icons/` contains all 4 required sizes (`icon-192`, `icon-512`, `icon-maskable-512`, `apple-touch-icon`) plus `icon.svg`; previously verified live in Phase 10S-B (correct name/colors/display mode) |
| Vercel env vars (names only) | ✅ All 3 expected vars present | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — all "Encrypted", scoped to **Production, Preview** (not Development), created 3 days ago |
| Supabase Auth Site URL / Redirect URLs | ☐ **Could not verify via tooling** | This is GoTrue/dashboard configuration, not exposed through SQL or the available MCP tools. Per the Phase 10S-B report this still needs manual confirmation at **Supabase Dashboard → Authentication → URL Configuration**: Site URL should be `https://jsg-camsecure-app.vercel.app`, with redirect URLs covering `https://jsg-camsecure-app.vercel.app/**`, `https://*.vercel.app/**`, and `http://localhost:3000/**` |
| Email alerts | ℹ️ Disabled | `email_alerts_enabled = false`, `email_queue` has 0 rows — Resend/email integration is not active (consistent with the Phase 10S-B note; not a blocker, just not turned on) |

---

## 7. Documentation — Untracked Docs

| File | Recommendation | Why |
|---|---|---|
| `docs/PHASE_10S_B_VERCEL_LIVE_DEPLOYMENT_VERIFICATION_REPORT.md` | **Commit** | Legitimate completed-phase verification report (2026-06-05); documents real production-verification work that already shipped — looks like it was simply missed when that phase's commit was made |
| `docs/PHASE_10T_A_CLIENT_PORTAL_NEWS_DEALS_REVIEW_PLAN.md` | **Commit** | Legitimate implementation plan that preceded the (already-committed and shipped) Announcements feature — keeping it documents the design rationale; also appears to have been missed at commit time |

Both read as genuine project history, not scratch/throwaway files — recommend committing both alongside (or just before) this audit report's commit, with a simple message like `docs: add missing Phase 10S-B and 10T-A reports`.

---

## 8. Summary

### Deployment status
✅ **Live and current.** Production (`dpl_J3SCSWvAivWAdGuAZ36q6zbbS4J5`) was auto-deployed within 2 seconds of the `1968f4f` push; `/api/admin/search` exists and is correctly auth-gated (verified both by HTTP behavior and by the route returning code-fingerprinted JSON).

### Workflow test result
✅ **All 11 steps wired correctly**, verified by reading the actual server actions, RPC (`convert_request_to_job`), and notification trigger functions, cross-checked against 91 real notification rows already generated in the live database. Recommend one final live click-through end-to-end before go-live (no browser-automation tool was available in this environment to drive that personally).

### Data cleanup recommendation
Clear split: **original seed data (2026-05-24)** is a judgment call (keep as demo or clear for blank handoff); **live exploratory-testing data (2026-05-30 → 2026-06-07)** — Norbert Company / Rahon / Ropar / Test Corp / Test Client / Test Tech / Punjab-India job sites / "Phase 10O-C test" requests / 4 unpublished test announcements — is unambiguously safe to delete. Full table in §4. **Nothing deleted yet.**

### Security findings
✅ **No issues found.** RLS enabled + org-scoped on every relevant table, service-role key confined to 2 server-only route handlers, no secrets committed, every portal and admin API route enforces auth + role checks server-side (verified live with a 401 against production).

### Production blockers
1. **⚠️ Live announcement reads as test content** — "Chk do fte" / "Ssa" is currently published and visible to clients. Should be unpublished or replaced before handoff.
2. **⚠️ `organizations.email` is the seed placeholder** (`admin@jsg.com`) rather than the real business email — likely user-facing on invoices/communications.
3. **☐ Supabase Auth Site URL / Redirect URLs** cannot be verified by tooling — must be manually confirmed in the Supabase dashboard before relying on auth email links / OAuth redirects in production.

### Non-blocking improvements
- `company_settings.abn`, `tax_rate`, `primary_color`, `logo_url` are empty — fill in for complete invoices/branding.
- Inactive seed admin `admin@jsg.com` and 4 inactive seed technicians could be archived for a cleaner account list.
- Email alerts (`email_alerts_enabled`) are off — turn on if the client expects email notifications.
- The two untracked docs (§7) should be committed to preserve project history.

### Recommended next action
1. **You decide** which rows in the §4 cleanup table to keep/archive/delete (especially the seed-vs-real judgment calls) — then a follow-up phase can perform the actual cleanup with your sign-off per row.
2. Replace or unpublish the "Chk do fte" announcement and update `organizations.email` to the real business address — both are quick, low-risk fixes that remove the two production blockers.
3. Manually confirm the Supabase Auth URL Configuration in the dashboard.
4. Optionally commit the two untracked docs (§7).

### Build/Lint result
✅ `npm run build` — 38 routes, 0 TypeScript errors
✅ `npm run lint` — 0 errors, 0 warnings

---

**No data was cleaned, no commits were made, and nothing was pushed — awaiting your review and approval before any follow-up action.**
