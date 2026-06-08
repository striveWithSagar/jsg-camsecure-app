# Phase 10U-B: Fresh Production Supabase Provisioning Plan

**Date:** 2026-06-07
**Scope:** Planning and audit only. No project created, no migrations applied, no Vercel env vars changed, no users copied, no data cleaned, no keys rotated, nothing committed/pushed.
**Build:** ✅ 38 routes · 0 TypeScript errors
**Lint:** ✅ 0 errors · 0 warnings

**Goal:** Establish an industry-standard split — a dedicated, clean Supabase project for production, separate from the development/staging project (`gbvstrhorjjvlxnfmxcz`) used for local dev and Vercel Preview.

> **⚠️ Corrected by Phase 10U-B1, then further corrected by Phase 10U-B2 (both 2026-06-07):** see [PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md](PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md) for full detail on all of the following:
> 1. **Demo-migration handling** (§1, §7) — "exclude the seed file from `db push`" was underspecified (no such flag exists). Corrected to: a **detached** temporary git worktree (`git worktree add --detach` — required, since the primary tree already has `main` checked out) with the file removed from its working copy via plain `rm` (never `git rm`/committed), then `supabase migration repair 20260524003809 --status applied` to record it in the ledger without executing it.
> 2. **Migration-list verification location** *(10U-B2)* — `supabase migration list` must be run from the **primary repository** (where all 18 files exist), not the temporary worktree — running it there would show only 17 Local versions (the demo file is genuinely absent from that checkout) and produce a false "17 vs 18" mismatch.
> 3. **First production account role** (§3, §4, §7) — corrected from `admin` to **`owner`**, because **nine** permanent-delete RLS policies (`profiles_delete_owner`, `clients_delete_owner`, `client_contacts_delete_owner`, `technicians_delete_owner`, `service_requests_delete_owner`, `jobs_delete_owner`, `invoices_delete_owner`, `ca_delete`, `notifications_delete`) are owner-exclusive; an admin-only bootstrap could never exercise them. *(10U-B2 corrected this count from an earlier miscount of 11 — `organizations_update_owner`/`company_settings_update_owner` were broadened to owner+admin by migration 5 and don't belong in the owner-exclusive set.)* A second `admin` account is created afterward for daily operations.
> 4. **Future seed-data structure** — Phase 10U-B1/B2 propose (not yet created) `supabase/seeds/development_demo.sql` and `supabase/seeds/production_bootstrap.sql.example`, activated via an **explicit, named** `supabase/config.toml` `[db.seed] sql_paths` entry (never a `*.sql` glob, so the production-bootstrap template can never be auto-executed by `db reset`).
> 5. **Worktree teardown timing** *(10U-B2)* — the temporary worktree is removed immediately after migration + schema verification, **not** held through the Vercel cutover/smoke-testing — rollback depends only on Vercel env-var restoration, never on the worktree.
>
> The sections below are left in their original form for the historical record where superseded; follow the 10U-B1/B2 documents' corrected mechanisms for actual execution.

---

## 1. Migration Inventory

18 migration files exist, in chronological order. All are additive/idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` before recreate) — none drop tables or destroy data.

| # | File | Creates / Changes |
|---|---|---|
| 1 | `20260524001041_create_base_schema.sql` | **Foundational.** 9 enums, 13 tables (`organizations`, `profiles`, `clients`, `client_contacts`, `technicians`, `service_requests`, `jobs`, `job_status_history`, `job_notes`, `job_photos`, `invoices`, `invoice_items`, `company_settings`), 30 indexes, `set_updated_at()` + 11 `updated_at` triggers, 4 RLS helper fns (`auth_org_id`, `auth_role`, `auth_technician_id`, `auth_client_id`), `fn_record_job_status_change`/`fn_record_job_status_insert` + 2 triggers, RLS enabled + 43 policies on all 13 tables |
| 2 | `20260524003809_seed_demo_data.sql` | **Demo seed only** — 1 org, 6 profiles (placeholder UUIDs, no `auth.users` rows), 7 clients, 7 contacts, 5 technicians, 5 requests, 13 jobs (+ auto status-history), 7 invoices, 7 invoice items |
| 3 | `20260524175529_convert_request_fn.sql` | RPC `convert_request_to_job()` v1 — insert job + mark request converted (SECURITY INVOKER) |
| 4 | `20260526061837_convert_request_guard.sql` | Replaces `idx_jobs_request_id` with a UNIQUE partial index; **replaces `convert_request_to_job()`** v2 — adds `FOR UPDATE` row lock + already-converted guard |
| 5 | `20260527025835_settings_rls.sql` | Drops/recreates `company_settings_update_owner` and `organizations_update_owner` policies — broadens from owner-only to owner+admin |
| 6 | `20260527033355_job_request_numbers.sql` | Adds `jobs.job_number` / `service_requests.request_number` (int, NOT NULL), 2 sequences, deterministic backfill, `assign_job_number`/`assign_request_number` trigger fns + triggers, 2 unique indexes |
| 7 | `20260527100000_photo_upload_schema.sql` | Adds 4 storage columns to `job_photos`; adds `job_photos_delete_uploader` policy; **creates `service_request_photos` table** + index + RLS (3 policies); **creates `camsecure-media` storage bucket** (private, 10 MB, image MIME allow-list) + 3 `storage.objects` RLS policies |
| 8 | `20260528000001_tighten_srp_delete.sql` | Drops/recreates `srp_delete` — adds missing `organization_id = auth_org_id()` + role gating (security fix for an over-broad policy) |
| 9 | `20260528000002_job_checklist_items.sql` | **Creates `job_checklist_items` table** + index + RLS (4 policies) + `updated_at` trigger; `fn_checklist_tech_col_guard` (column restriction) + trigger; `fn_jobs_checklist_guard` (blocks completion with open required items) + trigger on `jobs` |
| 10 | `20260529000001_client_request_edit_cancel.sql` | Drops + **recreates `convert_request_to_job()`** v3 — adds cancelled-request guard; adds `service_requests_update_client` policy; `fn_sr_client_col_guard` (column restriction) + trigger |
| 11 | `20260530000001_notifications.sql` | **Creates `notifications` table** + 2 indexes + RLS (4 policies); `fn_notification_read_guard` + trigger; adds `job_status_history_insert` policy; **rewrites `fn_record_job_status_change`** (adds admin+client notification emission); creates `fn_sr_status_client_notify` + trigger; drops + **recreates `convert_request_to_job()`** v4 — adds technician/client notification emission |
| 12 | `20260530000002_email_queue.sql` | Adds `company_settings.email_alerts_enabled`; **creates `email_queue` table** + 2 indexes + RLS (2 policies: block-all + admin-select) + `updated_at` trigger |
| 13 | `20260530000003_admin_managed_accounts.sql` | Adds `profiles.deactivated_at`, `technicians.is_active`, 2 lookup indexes, `profiles_insert_admin` policy |
| 14 | `20260530000004_add_site_address_to_service_requests.sql` | Adds `service_requests.site_address` (text, default `''`) |
| 15 | `20260530000005_backfill_site_address_from_client.sql` | **Data backfill** — copies `clients.address` into empty `service_requests.site_address` where linked |
| 16 | `20260601000001_client_request_notifications_and_tech_rls.sql` | Drops + recreates `clients_select` (adds technician read access); drops + **recreates `convert_request_to_job()`** v5 — adds admin broadcast notification + human-readable service-type labels |
| 17 | `20260606012810_client_announcements.sql` | Adds `company_settings.google_review_url`; **creates `client_announcements`** + `client_announcement_interests` tables + indexes + RLS (8 policies total) + `updated_at` trigger |
| 18 | `20260606030000_persist_preferred_request_and_job_deadline.sql` | Adds `service_requests.preferred_at`, `jobs.deadline_at` |

### Duplicate / superseded / unsafe migrations

- **`convert_request_to_job()` has 5 versions** across migrations 3, 4, 10, 11, 16 — each is a `CREATE OR REPLACE` (or `DROP` + recreate when the parameter list needed to change). This is **not unsafe**: applied in chronological order on a blank database, they collapse cleanly to the final v5 definition — verified live (see drift check below). No action needed; this is normal iterative-development history, and the final state is what matters for a fresh project.
- **`fn_record_job_status_change()` has 2 versions** (migration 1 → rewritten in migration 11). Same pattern — safe, collapses to the final version.
- **`20260530000004` + `20260530000005`** are a paired add-column + backfill — the backfill is a no-op on a blank database (no rows to backfill), so it's safe to include.
- **No destructive statements** (`DROP TABLE`, `TRUNCATE`, unconditional `DROP COLUMN`) appear anywhere in the chain.
- **Minor inconsistency (informational, not a blocker):** the v5 `convert_request_to_job()` (migration 16) omits `SET search_path = public`, which all earlier RLS helper functions and the v1–v4 versions included. Functionally harmless for a `SECURITY INVOKER` function (it's not a privilege-escalation vector), but it is what triggers the linter's `function_search_path_mutable` warning below — worth tidying in a future hardening pass, not a provisioning blocker.

### Can the migrations build a completely blank Supabase project from zero?

**Yes — with one migration handled specially, not simply excluded.** Applying the 17 schema migrations (everything except `20260524003809_seed_demo_data.sql`) in chronological order against an empty `public` schema produces a complete, working schema: all 19 tables, every index, every trigger/function, RLS enabled with every policy, and the `camsecure-media` storage bucket + its 3 object policies. This was confirmed two ways:
1. Every table, column, trigger function, and RLS policy referenced by migrations 2–18 was independently verified to exist in the live database with matching definitions (see drift check below).
2. The dependency order is correct — no migration references an object created by a later one (the only forward-reference, `service_requests.converted_to_job_id → jobs.id`, is explicitly resolved with a post-creation `ALTER TABLE` inside migration 1 itself).

> **Correction (10U-B1):** "skip the seed file" is not directly executable as a `db push` flag — `supabase db push` has no per-file exclude option, and would error/diverge if the file were simply deleted from the primary working tree (which would also violate "never rewrite an already-applied migration"). The corrected mechanism — a temporary git worktree with the file removed from its working copy only, followed by `supabase migration repair 20260524003809 --status applied` to record the version in the ledger without executing its SQL — is fully specified in [PHASE_10U_B1 §1](PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md#1-corrected-demo-migration-strategy). The seed migration's **content** must still never run against production — it inserts demo organizations, clients, technicians, jobs, and invoices with hardcoded placeholder UUIDs and **no matching `auth.users` rows**, none of which belong in a real production database (see §4 for what to seed instead).

### Database changes that exist live but are missing from migrations

**One bookkeeping gap, zero schema gaps.** Supabase's `list_migrations` (the `supabase_migrations.schema_migrations` history table) shows only the **first 7** migrations as formally recorded:

```
20260524001041 create_base_schema
20260524003809 seed_demo_data
20260524175529 convert_request_fn
20260526061837 convert_request_guard
20260527025835 settings_rls
20260527033355 job_request_numbers
20260527100000 photo_upload_schema
```

Migrations 8–18 (11 files) are **not** in that history table, yet their effects are fully present and byte-for-byte consistent with the migration files — confirmed by directly querying the live schema:
- All 6 newer tables exist (`service_request_photos`, `job_checklist_items`, `notifications`, `email_queue`, `client_announcements`, `client_announcement_interests`) — total 19/19 ✅
- All 7 newer columns exist (`preferred_at`, `site_address`, `deadline_at`, `google_review_url`, `email_alerts_enabled`, `deactivated_at`, `is_active`) ✅
- The live `convert_request_to_job()` function body contains `v_service_label` (the v5-only addition from migration 16) and **not** any earlier-version markers — confirming it is the final v5 ✅
- RLS is enabled with the correct policy count on all 19 tables ✅

**Conclusion:** migrations 8–18 were applied directly via SQL execution (e.g., MCP `execute_sql` / SQL editor) rather than through the CLI/migration-recording flow — exactly the workflow gap the Supabase skill warns about (`apply_migration` / direct `execute_sql` doesn't write history rows). **The files in the repo are the source of truth and are trustworthy** — there is no undocumented schema drift, only an incomplete history ledger on the *current* (dev/staging) project. This has **no impact on a fresh production project**: applying the 18 files in order via `supabase db push` (or the CLI's migration flow) on a brand-new project will record all of them correctly from a clean slate.
- One stale code comment: migration 1 says the `profiles` row is "created automatically by a trigger on `auth.users` (added in a later migration when auth is wired)". **No such trigger exists** in any migration or live in the database — instead, `/api/admin/accounts/route.ts` creates the `auth.users` row via `admin.auth.admin.createUser()` and inserts the matching `profiles` row directly via the service-role client in the same request. This is the actual, working mechanism (see §3) — the comment is simply outdated documentation, not a missing object.

---

## 2. Storage Inventory

| Item | Value |
|---|---|
| **Bucket** | `camsecure-media` (single bucket, created by migration 7) |
| **Privacy** | **Private** (`public = false`) |
| **Size limit** | 10,485,760 bytes (10 MB) |
| **Allowed MIME types** | `image/jpeg`, `image/png`, `image/webp`, `image/heic` |

### Storage RLS policies on `storage.objects` (3, all from migration 7 — verified live, byte-identical)

| Policy | Operation | Rule |
|---|---|---|
| `camsecure_media_select` | SELECT | `bucket_id = 'camsecure-media' AND name LIKE 'org/' \|\| auth_org_id() \|\| '/%'` |
| `camsecure_media_insert` | INSERT | same org-prefix check |
| `camsecure_media_delete` | DELETE | uploader (`owner = auth.uid()`) OR org-scoped owner/admin |

### Buckets/policies created manually and missing from migrations

**None found.** Querying `storage.buckets` live returns exactly the one bucket (`camsecure-media`, created 2026-05-28), and `pg_policies` on `storage.objects` returns exactly the 3 policies from migration 7 — no extras, no manual additions.

### Organization-scoped path structure

Confirmed convention — and confirmed **in active use** by sampling live `storage.objects` rows:

```
org/<organization_id>/jobs/<job_id>/<filename>
org/<organization_id>/requests/<request_id>/<filename>
org/<organization_id>/announcements/<announcement_id>/<filename>      ← in use, not in migration's path-comment
```

The `announcements/` segment (used for `client_announcements.poster_path`) is **not mentioned** in migration 7's path-convention comment, but it doesn't need its own policy — the existing wildcard rule `name LIKE 'org/' || auth_org_id() || '/%'` already covers any sub-path under an org's prefix. **No gap, just an outdated comment** worth a one-line documentation fix in a future pass.

---

## 3. Auth Requirements

### Required production roles

From the `user_role` enum (migration 1): `owner`, `admin`, `dispatcher`, `technician`, `client`. The application's `ADMIN_ROLES` set (`(dashboard)/layout.tsx`) treats `admin`, `owner`, and `dispatcher` as dashboard-eligible. For go-live, you need at minimum:
- **One `owner`** — see correction below; this must exist before (or alongside) any `admin`, because owner-exclusive RLS policies (delete operations across most tables) have no `admin` equivalent
- **One `admin`** — the day-to-day business operator account, created after the owner
- **`technician`** accounts — created as real staff come on board (via the in-app "Add Technician" flow, which uses the same admin-managed-accounts route)
- **`client`** accounts — created as real clients are onboarded
- `dispatcher` is an available role but **not required** to exist on day one

> **Correction (10U-B1 — role of the first account):** This section originally specified `role = 'admin'` for the first production account. That has been corrected to **`role = 'owner'`**. Reasoning and the full revised sequence are in [PHASE_10U_B1 §3](PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md#3-revised-production-owner-bootstrap): 11 distinct RLS policies across the schema (`organizations_update_owner`, `profiles_delete_owner`, `clients_delete_owner`, `client_contacts_delete_owner`, `technicians_delete_owner`, `service_requests_delete_owner`, `jobs_delete_owner`, `invoices_delete_owner`, `ca_delete`, `notifications_delete`, `company_settings_update_owner`) gate actions to `owner` only — an `admin`-only organization could never perform them.

### How the first real account should be created (owner, then admin)

The app has no public admin-signup route (by design — privileged accounts are provisioned, not self-registered). The corrected sequence is:

1. **Create the `auth.users` row** for `info@jsgcamsecure.ca` using `supabase.auth.admin.createUser()` — either via a one-off authenticated script using the **production** service-role key, or via **Supabase Dashboard → Authentication → Add User** (sets a real password directly, no email round-trip needed).
2. **Insert the matching `profiles` row** with `id` = the new `auth.users.id`, `organization_id` = the new production org's id, **`role = 'owner'`**, `email = 'info@jsgcamsecure.ca'`, `full_name`, `is_active = true`.
3. **Confirm owner login works** at `/login/admin` (the dashboard portal accepts `owner`/`admin`/`dispatcher`) and that owner-only UI affordances (e.g., delete actions) are reachable.
4. **Only then**, create a separate `admin` account for daily operations through the existing in-app "Add Account" UI (`/api/admin/accounts/route.ts` — `createUser` → insert `profiles` row, with rollback-on-failure) — now that there is a working owner session to drive it. From this point forward, **all further account creation happens through the existing in-app admin UI**, no scripts needed.

**Do not** copy password hashes or any existing `auth.users` rows from the development project — passwords are project-scoped secrets tied to GoTrue's own salt/config, and the dev project's accounts (including `admin@jsg.com`, `Test Tech QD`, etc.) are test/seed identities that have no place in production.

### Records that must be created after `auth.users` rows exist

| Record | When required | Created by |
|---|---|---|
| `profiles` | Immediately after each `auth.users` row — `profiles.id` **must equal** `auth.users.id` (enforced as the PK, not an FK, but the app assumes equality everywhere) | Same transaction/request as `createUser` (admin-accounts route pattern) |
| `client_contacts` | When a client company gets its first portal login — links a `clients` row + a `profiles` row via `profile_id` | Admin UI ("Add Client" / "Invite Contact" flows) — `profile_id` is nullable, so a contact can exist before they have a login |
| `technicians` | When a technician profile is created — `technicians.profile_id` is `UNIQUE NOT NULL` (one login = one technician slot) | Admin UI "Add Technician" flow, same request as the `auth.users`+`profiles` creation |

---

## 4. Production Seed Plan

Minimal, real-data-only seed for the new production project — **no demo/test/placeholder content**:

| # | Record | Values (from current live `organizations`/`company_settings`, with the email corrected) |
|---|---|---|
| 1 | `organizations` | `name = 'JSG CamSecure'`, `slug = 'jsg-camsecure'`, **`email = 'info@jsgcamsecure.ca'`** (the real address — the current dev project still has the seed placeholder `admin@jsg.com`, which should **not** be carried forward), `phone = '555-9000'` *(verify this is the real business number before seeding — it reads as a placeholder)*, `address = '100 Security Blvd, Suite 200'` *(verify this is the real business address)*, `logo_url = NULL` (add once branding assets exist) |
| 2 | `company_settings` | One row, `organization_id` → new org; `business_name = 'JSG CamSecure'`, `invoice_prefix = 'INV'`, `invoice_footer_note = 'JSG CamSecure — Professional Security Installation'`, `email_alerts_enabled = false` (enable once Resend/email is configured) |
| 3 | `google_review_url` | `https://share.google/oUog5JNnrv9slovfN` (copy from current `company_settings` — already a real, live URL) |
| 4 | Role/configuration records | None required beyond the org + settings rows above — roles come from the `user_role` enum (schema-level, created by migration 1), not seed data |
| 5 | Optional branding/settings | `abn`, `tax_rate`, `primary_color`, `logo_url` — leave `NULL` until the client provides real values (do not invent placeholder numbers for tax/ABN) |
| 6 | First real **owner** `profiles` row *(corrected from "admin" — see 10U-B1 §3)* | **Created only after** the `auth.users` account for `info@jsgcamsecure.ca` exists (§3) — `role = 'owner'`, `id` = that `auth.users.id`, `organization_id` → new org, `is_active = true`. A second, separate `admin` `profiles` row is created afterward, once owner login is confirmed, for daily operations |

**Explicitly excluded** (per the spec, and confirmed absent from this plan): test/seed/demo clients, technicians, jobs, requests, invoices, notifications, announcements, photos, test email addresses, passwords, or any secret values.

---

## 5. Environment Variable Map

All three Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are read in `src/lib/supabase/{client,server,service-role}.ts`. **Current state** (confirmed via `vercel env ls`): all three are scoped to **both** Production and Preview, pointing at the single dev/staging project (`gbvstrhorjjvlxnfmxcz`) — this is exactly the configuration that needs to change.

| Location | `NEXT_PUBLIC_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |
|---|---|---|---|
| **Local `.env.local`** | Development project URL (`https://gbvstrhorjjvlxnfmxcz.supabase.co`) | Development publishable key | Development service-role key |
| **Vercel → Preview** | Development project URL | Development publishable key | Development service-role key |
| **Vercel → Production** | **New** Production project URL | **New** Production publishable key | **New** Production service-role key |

No secret values are reproduced anywhere in this report — only variable **names** and **which project each should point to**.

---

## 6. Supabase Auth URL Plan

| | **New Production Supabase project** | **Existing Development Supabase project** |
|---|---|---|
| **Site URL** | `https://jsg-camsecure-app.vercel.app` | A localhost URL suitable for `next dev` — `http://localhost:3000` |
| **Redirect URLs** | `https://jsg-camsecure-app.vercel.app/**` | `http://localhost:3000/**` |
| **Preview URL strategy** | N/A — Preview deployments use the **Development** project (per the environment strategy in this plan), so they never need a production redirect URL | Add `https://*.vercel.app/**` to the Development project's redirect-URL allow-list, so that Vercel Preview deployments (which get per-branch `*.vercel.app` URLs) can complete auth redirects. This mirrors the configuration documented in the prior Phase 10S-B deployment report for the single-project setup, and continues to be correct once Preview is pinned to the Development project. |

This cleanly separates the two projects' auth configs: **Production Supabase only ever needs to know about the one stable production domain**; **Development Supabase needs to know about localhost and the full `*.vercel.app` wildcard** (covering every preview branch).

---

## 7. Deployment Procedure (ordered)

Steps marked **[HUMAN]** require dashboard access, secrets, or approval and cannot be automated by an agent. Steps marked **[AGENT]** can be run by Claude Code with the user's live supervision once approved.

> **⚠️ Steps 3–9 below are superseded by the corrected sequence in [PHASE_10U_B1 §6 (Runbook A–P)](PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md#6-revised-phase-10u-c-execution-runbook).** They are retained here for the historical record; follow the 10U-B1/B2 runbook for actual execution — it replaces the single "exclude the seed file" step with an explicit detached-worktree → dry-run → approve → apply → repair → verify(from primary repo) → teardown chain (with two separate approval gates and a corrected verification vantage point), and replaces the admin-first bootstrap (steps 8–9) with an owner-first sequence.

1. **[HUMAN]** Create a new Supabase project for production (Dashboard → New Project). Choose region close to users; record the project ref. *(= Runbook step B)*
2. **[HUMAN]** Retrieve the new project's URL, publishable key, and service-role key from Dashboard → Project Settings → API. Provide them securely (e.g., paste into a local `.env.production.local` that is git-ignored, or directly into Vercel's UI) — **never paste secret values into chat or commit them**.
3. ~~**[AGENT + HUMAN]** Link the Supabase CLI to the new production project directly~~ → **corrected:** create a **detached** temporary git worktree (`git worktree add --detach ../jsg-camsecure-prod-migration-tmp main` — required, since the primary tree already has `main` checked out), remove `20260524003809_seed_demo_data.sql` from its working copy with a plain `rm` (never `git rm`/committed), and link the CLI from there (Runbook steps C–D) — this is what makes "exclude the seed file" actually achievable, since `db push` has no per-file exclude flag and the primary tree's already-applied migration file must never be touched.
4. ~~**[AGENT]** Dry-run excluding the seed file~~ → **corrected:** run `supabase db push --dry-run` from the temporary worktree, where the demo file is genuinely absent from the migrations directory — the plan will cover exactly the 17 schema migrations (Runbook step E).
5. **[HUMAN approval gate]** User reviews the dry-run output and explicitly approves applying it to production. *(= Runbook step F)*
6. ~~**[AGENT]** Apply migrations, skipping file 2~~ → **corrected:** apply the 17 schema migrations from the temporary worktree (`supabase db push`), then — under a **separate, explicit approval** — run `supabase migration repair 20260524003809 --status applied` (still from the temporary worktree) to record the demo migration's version in the ledger without executing its SQL (Runbook steps G–H).
7. ~~**[AGENT]** Verify storage and schema ... plus `supabase migration list`~~ → **corrected:** **switch to the primary repository** (all 18 migration files present), link the CLI there to the same production project, and run `supabase migration list` to confirm all **18** versions align Local↔Remote — *running this check from the temporary worktree would show only 17 Local versions and produce a false mismatch*. Also verify the `camsecure-media` bucket, all 19 tables, RLS, functions/triggers — re-run the same queries used in this audit against the new project (Runbook step I). **Then immediately remove the temporary worktree** (`git worktree remove` + `git worktree prune`) — nothing further needs it (Runbook step J).
8. ~~**[HUMAN]** Create the first **admin** `auth.users` account~~ → **corrected:** create the first **owner** `auth.users` account for `info@jsgcamsecure.ca` (Dashboard → Authentication → Add User, real password set directly) (Runbook step K).
9. ~~**[AGENT]** Insert `organizations`/`company_settings`/first-**admin** `profiles` rows~~ → **corrected:** insert `organizations`, `company_settings`, and the first **owner** `profiles` row (`role = 'owner'`, `id` = the new `auth.users.id`) per the revised seed plan in §4; confirm owner login works; only then create a second, separate `admin` account through the in-app UI for daily operations (Runbook step L, plus the owner-then-admin sequence in [10U-B1 §3](PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md#3-revised-production-owner-bootstrap)).
10. **[HUMAN]** Update Vercel **Production** environment variables to the three new production values (Vercel Dashboard → Project → Settings → Environment Variables — edit each of the 3 vars, set scope to Production only, paste new values). *(= Runbook step N)*
11. **[HUMAN]** Confirm Vercel **Preview** environment variables remain pointed at the Development project (no change needed if they're already shared — but after step 10 splits the scopes, explicitly re-add/confirm the Development values for the Preview environment).
12. **[HUMAN or AGENT]** Trigger a redeploy of Production (push to `main`, or `vercel --prod` / "Redeploy" in the dashboard) so the new env vars take effect. *(= Runbook step O)*
13. **[AGENT, with HUMAN driving the browser]** Run production smoke tests — see the verification checklist in §9. Keep the rollback path (Vercel env-var restoration + redeploy — **not** the worktree, which was already removed in step 7/Runbook-J) ready until final sign-off. *(= Runbook step P)*

---

## 8. Rollback Plan

If the new production deployment fails (auth broken, RLS misconfigured, missing data, etc.), reverting is **fast and non-destructive** because the development project keeps running unchanged throughout:

1. In Vercel → Project → Settings → Environment Variables, **edit the three Production-scoped variables back to the Development project's values** (the same values currently live in Preview — no new project to provision, just re-pointing).
2. Trigger a redeploy of Production (push a no-op commit, or use "Redeploy" in the Vercel dashboard on the last-known-good deployment).
3. Production traffic now serves from the Development Supabase project again — **exactly the configuration that exists today**, so this is a same-day, low-risk reversal with no data loss (nothing in the working dev project was ever touched).
4. The failed production project can be paused or left alone for debugging — it holds no production traffic and no real user data, so there's no urgency or risk in leaving it as-is while you investigate.

Because the new production project is provisioned **alongside**, not **instead of**, the working setup, the "blast radius" of a failed cutover is limited to the few minutes between updating env vars and reverting them.

---

## 9. Verification Checklist

To be run against the **new production project + redeployed app** before declaring the cutover complete:

- [ ] `supabase migration list`, run from the **primary repository** (NOT the temporary worktree — see below), shows all **18** versions aligned Local↔Remote — 17 applied via `db push`, plus `20260524003809` recorded via `migration repair --status applied` *(corrected from "17" — see [10U-B1 §1](PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md#1-corrected-demo-migration-strategy); the demo migration's version must be present in the ledger, just not its SQL)*. ⚠️ Running this check from the temporary worktree would show only **17** Local versions (the demo file is genuinely absent from that checkout) and produce a **false** "17 vs 18" mismatch — always verify from the primary repo, where all 18 files exist.
- [ ] All 19 expected tables present (`select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'` → 19)
- [ ] RLS enabled on all 19 tables (`relrowsecurity = true`)
- [ ] All expected RLS policies present (spot-check policy counts per table against this audit's §1/live-DB figures: e.g., `jobs` → 4, `notifications` → 4, `client_announcements` → 5, `storage.objects` → 3)
- [ ] All RPCs/functions/triggers present — spot-check `convert_request_to_job`, `fn_record_job_status_change`, `fn_sr_status_client_notify`, `fn_jobs_checklist_guard`, `assign_job_number`/`assign_request_number`
- [ ] `camsecure-media` storage bucket present, private, 10 MB limit, correct MIME allow-list, 3 object policies
- [ ] Real **owner** login works at `/login/admin` with the `info@jsgcamsecure.ca` account *(corrected from "admin" — this is the first/owner account per the revised bootstrap in [10U-B1 §3](PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md#3-revised-production-owner-bootstrap)); separately confirm the second `admin` account (created afterward) also logs in correctly
- [ ] Client creation works (Admin → Clients → Add Client)
- [ ] Technician creation works (Admin → Technicians → Add Technician) — creates `auth.users` + `profiles` + `technicians` atomically
- [ ] Request-to-job workflow works end to end (mirrors the 11-step trace already verified against the dev project in Phase 10U-A — re-run against prod with one throwaway test request, then delete it)
- [ ] Notifications fire correctly (technician assignment, status change, client updates)
- [ ] Weekly Excel export works and includes "Client Preferred" and "Deadline" columns
- [ ] Global admin search works (`/api/admin/search`)
- [ ] **No demo/test records exist** — `select count(*) from clients`, `jobs`, `service_requests`, `technicians`, `client_announcements` should reflect only what was seeded in §4 plus any real records created during smoke-testing
- [ ] Vercel Production deployment commit matches the latest `main` commit
- [ ] Production environment variables (`NEXT_PUBLIC_SUPABASE_URL` etc.) resolve to the **new production** Supabase project, not the development one (the same JSON-fingerprint technique used in Phase 10U-A — or simply query `organizations` and confirm only the production org row exists)

---

## Summary

### Whether migrations can recreate the backend from zero
**Yes.** The 17 schema migration files (everything except the demo-seed file, #2), applied in order, fully recreate the schema, RLS, functions/triggers, and storage bucket+policies from a blank project. Verified by cross-checking every table, column, function body, and policy referenced in migrations 2–18 against the live database. *(Corrected mechanism for handling #2 — temporary worktree + `migration repair`, not a bare "exclude" — is in [10U-B1 §1](PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md#1-corrected-demo-migration-strategy).)*

### Missing migration objects
**None.** Every schema object that exists live is accounted for by a migration file. The only gap is bookkeeping: migrations 8–18 aren't recorded in the `schema_migrations` history table on the *current* project (they were applied via direct SQL execution rather than the CLI flow) — but their contents are present and correct, and a fresh project applying the files via `supabase db push` will record all of them properly. One stale code comment (a since-superseded plan to add an `auth.users` trigger) and one outdated path-convention comment (missing the `announcements/` segment) are documentation nits, not schema gaps.

### Storage requirements
One private bucket, `camsecure-media` (10 MB limit, 4 image MIME types), with 3 RLS policies enforcing the `org/<org_id>/...` path convention. No manually-created buckets/policies exist outside the migrations — the new project needs nothing beyond what migration 7 creates.

### Minimal production seed requirements
Just the org row (with the **real** email `info@jsgcamsecure.ca`, replacing the current placeholder `admin@jsg.com`), one `company_settings` row (carrying over the real `google_review_url` and invoice branding text), and the first **owner's** `profiles` row — created only after its `auth.users` account exists, followed by a separate `admin` account once owner login is confirmed. *(Corrected from "first admin's profiles row" — see [10U-B1 §3](PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md#3-revised-production-owner-bootstrap).)* Everything else (clients, technicians, jobs, requests, invoices, notifications, announcements) starts empty and is populated by real usage.

### Human-only steps
Creating the Supabase project, retrieving/handling secret keys, authenticating the Supabase CLI (`supabase login`), creating the first **owner's** `auth.users` account (Dashboard → Add User), creating the second **admin** account afterward, configuring Supabase Auth URLs, editing Vercel environment variable values, and approving the migration dry-run **and** the separate migration-repair step before either is applied. These all involve either dashboard access, live secrets, or an irreversible-ish go/no-go decision.

### Automated steps
Creating a **detached** temporary git worktree with the demo migration removed from its working copy via plain `rm`, linking the CLI there (with the user's auth), running the migration dry-run and apply (17 schema migrations) plus `migration repair` for the demo version, **switching to the primary repository to verify** migration-ledger/storage/schema alignment (all 18 versions — never checked from the temporary worktree, which would show only 17), **removing the temporary worktree immediately afterward**, inserting the seed rows (org/settings/**owner**-profile) once the human supplies the new owner's user ID, and running the smoke-test checklist with the user driving the browser. *(Updated to reflect the corrected worktree+repair mechanism, verification vantage point, and owner-first bootstrap — see [10U-B1/B2](PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md).)*

### Risks
1. **Mixing up which env points where** — the highest-probability failure mode is accidentally leaving Production pointed at the dev project (or Preview pointed at the new prod project). Mitigate by checking `vercel env ls production`/`preview` immediately after the env-var edit, before redeploying.
2. ~~**Forgetting to exclude the seed migration**~~ → **corrected/expanded:** running `db push` from the wrong directory (primary tree instead of the temporary worktree) would queue the demo migration's inserts for production. Mitigate by confirming the working directory and linked-project output immediately before any push — full detail in [10U-B1 risk #1](PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md#risks).
3. **Owner-first bootstrap order** — creating the `profiles` row before the `auth.users` row (or with a mismatched ID, or with the wrong role) breaks login or leaves the org without an account that can perform owner-exclusive actions. Mitigate by following the exact sequence in [10U-B1 §3](PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md#3-revised-production-owner-bootstrap) — `role = 'owner'` first, confirm login, then a separate `admin`. *(Justification corrected in 10U-B2: 9 owner-exclusive permanent-delete policies, not 11 — `organizations_update_owner`/`company_settings_update_owner` are owner+admin since migration 5.)*
4. **Forgetting the Auth URL config on the new project** — without it, login/redirect flows will fail in production even with correct env vars and schema. Mitigate with §6 as an explicit pre-go-live checklist item.
5. **Pre-existing linter warnings carry over** — `get_advisors` flags `function_search_path_mutable` on 8 functions and `auth_leaked_password_protection` disabled. These exist in the current dev project and will be inherited by the new production project (they come from the migration files / are project-level Auth settings). None are blockers — the `SECURITY DEFINER` warnings on the `auth_*` helpers are intentional-by-design (documented in the migration's own comments, and they gracefully return `NULL` when unauthenticated). Recommend enabling **leaked-password protection** on the new production project during setup (a one-click Dashboard toggle, zero schema risk) and tidying the missing `SET search_path = public` on 8 functions in a future hardening pass.
6. **Conflating the dry-run approval with the migration-repair approval** *(added in 10U-B1)* — `db push` executes SQL; `migration repair` only edits a ledger. Treating them as one approval risks the user signing off on more than they realized. Keep them as two distinct checkpoints (Runbook steps F and the gate before H).
7. **Verifying migration alignment from the wrong location, or holding the worktree too long** *(new — added in 10U-B2)* — running `migration list` from the temporary worktree shows a false "17 vs 18" mismatch (the demo file is genuinely absent there); and keeping the worktree alive through Vercel cutover/smoke-testing adds a stale artifact during the highest-stakes phase for no benefit, since rollback depends only on Vercel env vars. Mitigate by verifying from the primary repo (Runbook step I) and removing the worktree immediately afterward (Runbook step J) — full detail in [10U-B1 risks #4–5](PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md#risks).

### Rollback procedure
Re-point the 3 Vercel **Production** env vars back to the Development project's values (the same values Preview already uses) and redeploy — reverts to today's exact working configuration in minutes, with zero data loss, since the dev project is never modified during the cutover attempt. **Rollback never depends on the temporary migration worktree** — by the time Vercel cutover happens, that worktree has already been removed (Runbook step J, immediately after migration verification).

### Recommended Phase 10U-C execution plan
**Superseded by the A–P runbook in [10U-B1 §6](PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md#6-revised-phase-10u-c-execution-runbook)** — summary:
1. User confirms real organization values; creates the Supabase production project (steps A–B).
2. Agent creates a **detached** temporary migration worktree, removes the demo migration from its working copy with plain `rm`, links the CLI there, and runs the dry-run for approval (steps C–F).
3. On approval: agent applies the 17 schema migrations; on a **separate** approval, runs `migration repair` for the demo version; **switches to the primary repository** to verify all 18 migrations/schema/storage align (never from the temporary worktree, which would show only 17) (steps G–I).
4. Agent **removes the temporary worktree immediately** — before any Vercel changes begin (step J).
5. User creates the first **owner** `auth.users` account; agent inserts org/settings/owner-profile rows (steps K–L).
6. User configures Supabase Auth URLs and edits Vercel **Production** env vars only (steps M–N).
7. User/agent triggers redeploy and runs smoke tests (step O).
8. Both keep the rollback path ready until final sign-off — Vercel env-var restoration + redeploy only, **not** the worktree, which is already gone (step P).

This sequencing keeps every irreversible or secret-touching action in human hands, while the agent handles the mechanical, auditable, and reviewable parts — and keeps a clean rollback available at every stage.

### Build/Lint result
✅ `npm run build` — 38 routes, 0 TypeScript errors
✅ `npm run lint` — 0 errors, 0 warnings

---

**Nothing was created, modified, migrated, copied, rotated, committed, or pushed. This document is a plan for your review and approval before any execution begins.**
