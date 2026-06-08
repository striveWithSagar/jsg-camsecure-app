# Phase 10U-B1: Correct Production Migration Packaging and Bootstrap Plan

**Date:** 2026-06-07 (corrected by Phase 10U-B2, same date)
**Scope:** Planning and repository-preparation review only. No production project created/linked, no `db push`, no migration repair run, no Vercel env vars changed, no Auth users created, no production data inserted, no demo data deleted, nothing committed/pushed.
**Build:** ✅ 38 routes · 0 TypeScript errors
**Lint:** ✅ 0 errors · 0 warnings

> **⚠️ Corrected by Phase 10U-B2 (2026-06-07):** Five technical details below were further corrected after a second user review:
> 1. **Worktree creation** (§1, §6) — must use `git worktree add --detach` (the primary worktree already has `main` checked out; a non-detached add would hit Git's branch-already-checked-out protection), and the demo file must be removed with a plain filesystem `rm` (not `git rm`, never committed).
> 2. **`migration list` verification location** (§1, §6) — running it from the temporary worktree (where the demo file is absent) would show only **17** local versions, not 18. Full 18-version Local↔Remote alignment must be verified from the **primary repository** (where all 18 files exist), linked to the same production project.
> 3. **Owner-only policy count** (§3) — corrected from 11 to **9**: `organizations_update_owner` and `company_settings_update_owner` were broadened to owner **+ admin** by migration 5, so they are not owner-exclusive. 9 permanent-delete policies remain owner-only — still sufficient justification for the owner-first bootstrap.
> 4. **Seed folder activation** (§2) — local dev seeding requires explicit `supabase/config.toml` configuration (`[db.seed]` with a named `sql_paths` list), not a broad glob — so `production_bootstrap.sql.example` is never auto-executed by `db reset`.
> 5. **Worktree teardown timing** (§1, §6) — moved to immediately after migration + schema verification (not held through Vercel cutover/smoke testing); rollback never depends on the worktree, only on Vercel env-var restoration.
>
> This phase corrects three risks identified during review of [PHASE_10U_B_FRESH_PRODUCTION_SUPABASE_PROVISIONING_PLAN.md](PHASE_10U_B_FRESH_PRODUCTION_SUPABASE_PROVISIONING_PLAN.md):
1. The original plan said "apply 17 migrations, skip the seed file" — but `supabase db push` has no per-file exclude flag, so that instruction wasn't directly executable.
2. There was no concrete plan for where future seed files should live, separate from schema migrations.
3. The original plan bootstrapped the first production account as `admin` — but the schema has owner-only actions (deleting clients, technicians, jobs, invoices, requests, profiles, notifications, announcements — see `*_delete_owner`/`ca_delete`/`notifications_delete` policies in the base schema and later migrations), so an `admin`-only org would have no account that can ever perform those operations.

---

## 1. Corrected Demo-Migration Strategy

### The problem, precisely

`supabase/migrations/20260524003809_seed_demo_data.sql` is a **migration file**, not a configurable seed (Supabase's seed mechanism is `supabase/seed.sql`, run only by `db reset` in local dev — this file is a timestamped migration that `db push` will apply unconditionally and in order, like every other file in the directory). `db push` has no `--exclude` / `--skip` flag for individual migration files. So "apply the other 17, skip this one" cannot be expressed as a single `db push` invocation against the real migrations directory.

### The corrected procedure

Use a **temporary, isolated copy of the repository** (a git worktree) in which the demo-seed file is *temporarily absent from the filesystem* — never deleted from the real history — run `db push` there, and then tell the production project's migration ledger that the skipped version was handled intentionally via `migration repair`. Concretely:

1. **Create a temporary, *detached* git worktree** from the current `main` (or whatever branch is being deployed) at a throwaway path:
   ```
   git worktree add --detach ../jsg-camsecure-prod-migration-tmp main
   ```
   The `--detach` flag is **required**: the primary working tree already has `main` checked out, and Git refuses to check the same branch out in two worktrees simultaneously ("branch already checked out" protection). A detached checkout starts at the same commit as `main` without claiming the branch ref, so it satisfies Git and still gives a byte-identical copy of the repo at that commit. A worktree is a full second checkout sharing the same `.git` object store — nothing is cloned twice, and removing the worktree directory afterward leaves the primary tree and its history completely untouched.
2. **Inside the temporary worktree only**, remove the single file with a plain filesystem deletion — **not** `git rm`, and the deletion is **never committed**:
   ```
   rm supabase/migrations/20260524003809_seed_demo_data.sql
   ```
   Because the worktree is detached (not on a branch) and nothing here is staged or committed, this is purely a working-directory change to a disposable checkout — it can never be merged, pushed, or propagated back to `main`. The remaining 17 files stay exactly as committed. The committed file in the primary working tree is completely untouched throughout.
3. **Link the Supabase CLI to the new production project from inside the temporary worktree** (`supabase link --project-ref <new-prod-ref>`).
4. **Run `supabase db push --dry-run`** from the temporary worktree. With the demo file absent from its migrations directory, the CLI's plan will show exactly 17 files to apply — review this output and confirm it contains only schema-creation statements (no `INSERT INTO clients/jobs/...`).
5. **On explicit user approval**, run `supabase db push` for real from the temporary worktree — this applies the 17 schema migrations to the new production project and records each of their versions (`20260524001041` through `20260606030000`, minus `20260524003809`) in that project's `supabase_migrations.schema_migrations` history table.
6. **Record the intentionally-skipped demo migration** — *only after explicit separate approval for this specific destructive-sounding step* — by running, still from the temporary worktree (which remains linked to the production project):
   ```
   supabase migration repair 20260524003809 --status applied
   ```
   This command does not run any SQL — it only inserts a row into the production project's migration-history ledger recording that version `20260524003809` is considered applied, **without executing its contents**. This is the standard, CLI-documented mechanism for telling Supabase "this version is intentionally accounted for" when the corresponding SQL was deliberately not run (the mirror image of how it's used to mark a *failed* migration as `reverted`).
7. **Verify migration alignment from the PRIMARY repository — not the temporary worktree.** This is a critical distinction:
   - If you run `supabase migration list` **from the temporary worktree**, the demo file is absent from its `supabase/migrations/` directory, so the CLI's **Local** column will show only **17** versions — it would *appear* to mismatch the Remote column's 18, even though the production project's ledger is perfectly correct. **Do not run the verification here, and do not claim full Local/Remote alignment from this vantage point** — the absence is an artifact of the temporary checkout, not a real discrepancy.
   - Instead, switch to the **primary working tree** (where all 18 migration files exist, exactly as committed on `main`), link the Supabase CLI there to the **same** production project (`supabase link --project-ref <new-prod-ref>`), and run `supabase migration list`. From here, the **Local** column correctly enumerates all 18 files, and the output should show all 18 timestamps (`20260524001041` … `20260606030000`) present and aligned between **Local** and **Remote** — `20260524003809` showing as applied-via-repair (no corresponding executed SQL, but ledger-synchronized) and the other 17 showing as applied-via-`db push`.
8. **Remove the temporary worktree immediately after migration and schema verification (step 7) — do not hold it through the Vercel cutover or smoke testing:**
   ```
   git worktree remove ../jsg-camsecure-prod-migration-tmp
   git worktree prune
   ```
   The migration phase is the *only* phase that needs the temporary worktree — every later step (owner bootstrap, Auth URL config, Vercel env-var changes, redeploy, smoke tests, rollback) operates on the production project directly or through Vercel/the primary repo, none of which need a second checkout. **Rollback never depends on the worktree** — it is purely a Vercel Production environment-variable restoration + redeploy (§8 of the provisioning plan), so there is no reason to keep a disposable checkout alive through the riskiest, most user-facing part of the cutover. The primary working tree, its commit history, and the committed migration file `20260524003809_seed_demo_data.sql` are **never modified, renamed, or deleted** at any point — they remain exactly as committed on `main`, satisfying "do not rename, delete, or rewrite an already-applied migration in the primary working tree."

### Why this satisfies every constraint in the spec

| Requirement | How this procedure satisfies it |
|---|---|
| Preserves the committed historical migration file | File is removed only via plain `rm` inside a disposable, **detached** worktree's working copy — never `git rm`, never committed, never touching `main` or any commit |
| Avoids Git's branch-checkout protection | `git worktree add --detach` starts the temporary checkout at the same commit without claiming the `main` ref, which the primary tree already holds |
| Does not execute the demo inserts against production | The 17-file `db push` never sees the file; `migration repair` runs no SQL at all |
| Applies the other 17 migrations in order | `db push` applies whatever is present, in timestamp order — with the file absent, that's exactly the 17 schema migrations |
| Records `20260524003809` as applied without executing it | `migration repair <version> --status applied` is precisely the documented no-SQL ledger-write operation for this |
| Leaves future normal `db push` synchronized | Once the ledger shows all 18 versions as applied, a later `db push` against the **real** (committed) migrations directory — which still contains the demo file, since it was never removed from `main` — will see version `20260524003809` already recorded and skip it; nothing pends forever |
| Uses `migration repair` only after explicit approval | Step 6 is gated as its own separate approval point, distinct from the `db push` approval in step 5 — because telling a system "treat this as already done" is qualitatively different from "do this," and deserves its own sign-off |
| Verifies alignment correctly, from the right vantage point | Step 7 explicitly runs `supabase migration list` from the **primary repository** (all 18 files present), not the temporary worktree (where it would misleadingly show only 17 Local versions) |
| Tears down the worktree at the right time | Step 8 removes it immediately after verification — before the Vercel cutover — since nothing past this point depends on it |

### Net result

The production project ends up in **exactly the schema state** it would be in had the demo migration simply not existed — while the migration ledger stays fully synchronized for every future `db push`, and the repository's history remains completely untouched. This is the standard, supported pattern for "this historical migration shouldn't run on this environment" — it's exactly what `migration repair` exists for. Verification of that synchronization must happen **from the primary repository**, where all 18 files genuinely exist — running it from the temporary worktree would manufacture a false "17 vs 18" discrepancy that doesn't reflect the production project's actual (correct) state.

---

## 2. Future Seed-Data Structure (proposal only — no files moved or created yet)

**Proposed layout:**

```
supabase/
  migrations/                              (unchanged — schema only, ever)
  seeds/
    development_demo.sql                   (new — demo data for local/dev use)
    production_bootstrap.sql.example       (new — placeholder template, committed)
```

### `supabase/seeds/development_demo.sql`
- **Purpose:** the natural new home for what `20260524003809_seed_demo_data.sql` does today — demo clients, contacts, technicians, requests, jobs, invoices — but expressed as a **seed**, not a migration, so it can be run on demand (`supabase db reset`, which executes the configured seed files against a fresh local DB) rather than unconditionally on every `db push`.
- **Rule:** demo clients/jobs/technicians/requests/invoices only — exactly the kind of content the existing migration already contains. Never run against production.
- **Migration concern stays separate:** moving the *content* here does **not** mean deleting or rewriting the original migration file — that file remains the historical record of what was actually run on the dev project on 2026-05-24 (per the "do not rewrite an already-applied migration" rule). This new file would be a **forward-looking duplicate for convenience**, written fresh, not a move of the old one.

### `supabase/seeds/production_bootstrap.sql.example`
- **Purpose:** a committed **template** — the `.example` suffix signals "copy this, fill in real values, never commit the filled-in copy" (the same convention already used by `.env.local.example` in this repo).
- **Contents:** `INSERT` statements for `organizations`, `company_settings`, and the first owner `profiles` row, with **placeholder tokens** (e.g., `'<REAL_BUSINESS_EMAIL>'`, `'<REAL_PHONE_OR_NULL>'`, `'<OWNER_AUTH_USER_ID>'`) wherever a real value is needed — never actual secrets, names, or IDs.
- **Execution stays manual and approval-gated:** the real, filled-in version of this file (or the equivalent direct `INSERT`s run by the agent under live supervision) is never auto-applied by `db push` — it is a one-time bootstrap step requiring the production org's real values (§4 of the provisioning plan / [PRODUCTION_BOOTSTRAP_VALUES_TEMPLATE.md](PRODUCTION_BOOTSTRAP_VALUES_TEMPLATE.md)) and the new owner's `auth.users.id` (which doesn't exist until a human creates that account).
- **Hard rule — must never contain:** auth passwords or hashes, Supabase secret/service-role keys, test users, demo clients, jobs, invoices, requests, announcements, or notifications. Only the minimal real-organization bootstrap rows described in §4 of the provisioning plan.

### Required `supabase/config.toml` activation (proposal — config not yet changed)

Supabase's local seeding only runs files that are **explicitly named** in `supabase/config.toml` under `[db.seed]` — by default, nothing in `supabase/seeds/` is picked up automatically, and there is **no implicit "run everything in this folder"** behavior to rely on. The configuration must name `development_demo.sql` **specifically**, by exact path — **not** a glob like `./seeds/*.sql`:

```toml
[db.seed]
enabled = true
sql_paths = ["./seeds/development_demo.sql"]
```

**Why an explicit path, not a glob, is mandatory here:** a glob such as `./seeds/*.sql` would match *both* files in the folder — including `production_bootstrap.sql.example` (or, if ever copied locally to `production_bootstrap.sql` for a real bootstrap run, that file too). `db reset` would then execute the production-bootstrap template/contents against the local dev database on every reset — at best inserting placeholder-token garbage, at worst (if someone had filled in real values locally for review) leaking real org data into a shared dev project. Naming `development_demo.sql` explicitly in `sql_paths` makes it structurally impossible for `production_bootstrap.sql.example` to be auto-executed by any local workflow — it can only ever be run by a human, deliberately, copying and filling in its contents by hand.

**This section, including the `config.toml` change, is a proposal for review — no files have been created, moved, or modified under `supabase/seeds/`, and `supabase/config.toml` has not been touched.** If approved, creating `development_demo.sql`, the `.example` template, and adding the `[db.seed]` block would be simple additive changes (no migration-history impact, since `seeds/` and `config.toml` are outside `migrations/`); moving/retiring the *old* migration file would be a separate, more sensitive decision this plan does **not** recommend (it's already-applied history — see the "do not rewrite" rule).

---

## 3. Revised Production Owner Bootstrap

The original 10U-B plan named `info@jsgcamsecure.ca` as the first **admin**. This is corrected: it must be the first **owner**.

### Why `owner`, not `admin`

Walking the RLS policies created across the migration chain, **nine** operations are gated to `owner` **only** — no `admin`, `dispatcher`, or any other role can perform them:

| Table | Owner-only policy | Operation |
|---|---|---|
| `profiles` | `profiles_delete_owner` | DELETE |
| `clients` | `clients_delete_owner` | DELETE |
| `client_contacts` | `client_contacts_delete_owner` | DELETE |
| `technicians` | `technicians_delete_owner` | DELETE |
| `service_requests` | `service_requests_delete_owner` | DELETE |
| `jobs` | `jobs_delete_owner` | DELETE |
| `invoices` | `invoices_delete_owner` | DELETE |
| `client_announcements` | `ca_delete` | DELETE |
| `notifications` | `notifications_delete` | DELETE |

> **Correction (10U-B2):** an earlier draft of this table also listed `organizations_update_owner` and `company_settings_update_owner` as owner-exclusive (totaling 11). That was wrong — **migration 5** (`20260527025835_settings_rls.sql`) explicitly drops and recreates both policies to **broaden** them from owner-only to **owner + admin**. They are correctly excluded from the table above; the owner-exclusive set is **nine** permanent-delete operations, all following the same shape (`*_delete_owner` / `ca_delete` / `notifications_delete`).

If the org's only privileged account were `admin`, **no one could ever permanently delete a client, client contact, technician, job, invoice, service request, profile, announcement, or notification** — a real operational gap the day something needs to be removed outright (e.g., correcting a data-entry mistake, removing a departed technician's account entirely rather than just deactivating it, purging a test record created during smoke-testing). Bootstrapping with `owner` first guarantees the org always has at least one account capable of every action the schema allows — the nine permanent-delete operations above remain the deciding justification even with the corrected, smaller count.

### Revised sequence

1. **[HUMAN]** Create the `auth.users` account for `info@jsgcamsecure.ca` (Dashboard → Authentication → Add User, real password set directly).
2. **[AGENT, with the human-supplied user ID]** Insert the `profiles` row with:
   - `id` = the new `auth.users.id` (must be **equal**, not merely linked — it's the primary key and the app assumes equality everywhere)
   - `organization_id` = the newly created production `organizations.id`
   - `role = 'owner'`
   - `email = 'info@jsgcamsecure.ca'`
   - `full_name` = the confirmed real name for this account
   - `is_active = true`
3. **[HUMAN]** Log in as the owner at `/login/admin` (the `(dashboard)` portal accepts `owner`/`admin`/`dispatcher` — there is no separate "/login/owner") and confirm the session works and owner-only UI affordances (e.g., delete actions) are reachable.
4. **Only after owner login is confirmed**, create a second, **separate `admin` account** for day-to-day operations — through the in-app "Add Account" flow (the same `/api/admin/accounts/route.ts` mechanism), now that there's a working owner session to drive it. This keeps the rarely-used, high-privilege `owner` identity distinct from the account used for daily dispatching/management.

This produces an organization with **at least one `owner`** (capable of every action) **and at least one `admin`** (for daily operations) — matching how a real multi-role organization should be bootstrapped, and avoiding the single-role gap in the original plan.

---

## 4. Organization Data Manifest

Moved to its own document for clarity and reuse: **[PRODUCTION_BOOTSTRAP_VALUES_TEMPLATE.md](PRODUCTION_BOOTSTRAP_VALUES_TEMPLATE.md)**.

Summary of what it contains:
- A field-by-field table (legal name, real email, real phone, real address, invoice prefix, invoice footer, Google Review URL, tax number, tax rate, logo URL, primary brand color) with each field's **current dev-project value**, whether that value is real or a **placeholder that must not be carried forward**, and a slot for the **confirmed production value**.
- `phone: 555-9000` and `address: 100 Security Blvd, Suite 200` are explicitly flagged as placeholders (classic demo-data patterns inserted by the 2026-05-24 seed migration) that must **not** be copied into production.
- Every field without a confirmed real value is to be seeded as `NULL` (all are nullable columns — confirmed against the base schema) rather than guessed — particularly `tax_rate`, where a wrong guess would silently misprice every invoice until caught.
- An explicit list of what the manifest must never contain: passwords/hashes, secret keys, test users, demo business records.

---

## 5. Production Configuration Manifest (redacted — names only, never values)

| Location | Variables | Points to |
|---|---|---|
| **Local `.env.local`** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | **Development** Supabase project (`gbvstrhorjjvlxnfmxcz`) |
| **Vercel → Preview** | same three variable names | **Development** Supabase project (unchanged) |
| **Vercel → Production** | same three variable names | **New Production** Supabase project (to be created) |

No key material, project refs beyond the already-public dev project ref, or any other secret is reproduced here — this table exists purely to make explicit *which logical environment each variable name should resolve to*, matching §5 of the provisioning plan. The actual values are retrieved and entered exclusively by the human, directly in the Supabase Dashboard and Vercel Dashboard (see Runbook step M).

---

## 6. Revised Phase 10U-C Execution Runbook

| Step | Owner | Action |
|---|---|---|
| **A** | User | Confirms real organization values — fills in [PRODUCTION_BOOTSTRAP_VALUES_TEMPLATE.md](PRODUCTION_BOOTSTRAP_VALUES_TEMPLATE.md) (or explicitly approves `NULL` for any field) |
| **B** | User | Creates the new production Supabase project (Dashboard → New Project); records the project ref |
| **C** | Agent | Creates a **detached** temporary git worktree — `git worktree add --detach ../jsg-camsecure-prod-migration-tmp main` (required: the primary tree already has `main` checked out) — then removes `supabase/migrations/20260524003809_seed_demo_data.sql` from that worktree's working copy with a plain `rm` (not `git rm`, never committed) — primary tree untouched |
| **D** | User | Authenticates the Supabase CLI (`supabase login`) and links it to the new production project (`supabase link --project-ref <new-ref>`), **from within the temporary worktree** |
| **E** | Agent | Runs `supabase db push --dry-run` from the temporary worktree — with the demo file absent, the plan covers exactly the 17 schema migrations; agent reviews the output for any unexpected destructive statements |
| **F** | User | Reviews the dry-run plan and explicitly approves (or rejects) proceeding |
| **G** | Agent | On approval, runs `supabase db push` for real from the temporary worktree — applies the 17 schema migrations and records their versions in the production ledger |
| **H** | Agent | **On a separate, explicit approval**, runs `supabase migration repair 20260524003809 --status applied` (still from the temporary worktree, still linked to production) to record the intentionally-skipped demo migration in the ledger without executing any SQL |
| **I** | Agent | **Switches to the PRIMARY repository** (where all 18 migration files exist), links the CLI there to the **same** production project, and runs `supabase migration list` — confirms all **18** versions show Local↔Remote aligned. *(Do not run this check from the temporary worktree — its Local column would show only 17, since the demo file is absent there, producing a false mismatch.)* Also runs the same table/RLS/function/trigger/storage queries used in the original audit, against the new production project |
| **J** | Agent | **Removes the temporary worktree now** — immediately after migration + schema verification, before touching Vercel: `git worktree remove ../jsg-camsecure-prod-migration-tmp` then `git worktree prune`. Nothing past this point needs it — owner bootstrap, Auth URL config, env-var changes, redeploy, smoke tests, and rollback all operate on the production project, Vercel, or the primary repo directly |
| **K** | User | Creates the **owner** `auth.users` account for `info@jsgcamsecure.ca` (Dashboard → Add User) |
| **L** | Agent | Inserts the `organizations`, `company_settings`, and **owner** `profiles` rows, using the confirmed values from step A and the user-supplied `auth.users.id` from step K |
| **M** | User | Configures the new production project's Supabase Auth Site URL / Redirect URLs (per §6 of the provisioning plan: Site URL `https://jsg-camsecure-app.vercel.app`, Redirect URL `https://jsg-camsecure-app.vercel.app/**`) |
| **N** | User | Updates **only** the Vercel **Production**-scoped environment variables to the new project's values; confirms Preview remains pointed at the Development project |
| **O** | User / Agent | Triggers a redeploy; agent runs the smoke-test checklist (§9 of the provisioning plan) with the user driving the browser |
| **P** | Both | Keep the rollback path ready until final sign-off. **Rollback does not depend on the worktree** (already removed in step J) — it is purely re-pointing the 3 Vercel Production env vars back to the Development project's values and redeploying |

This differs from the original 10U-C sketch in four ways: (1) it makes the worktree creation an explicit step (C) using a **detached** checkout and plain `rm`, and its **teardown** an explicit step (J) placed immediately after verification rather than held to the end; (2) it splits the single "apply migrations" step into a dry-run/approve/apply/repair/verify chain with **two separate approval gates** (F for the push, a distinct gate before H for the repair) **and** a corrected verification step (I) that explicitly runs from the primary repo, not the temporary worktree; (3) it bootstraps an **owner** account (steps K/L) instead of an admin, with a note that a second `admin` account follows once owner login is confirmed; and (4) it makes explicit that **rollback (step P) depends only on Vercel**, never on the worktree, which is why the worktree can safely be removed long before cutover.

---

## Summary

### Corrected demo-migration strategy
Create a **detached** temporary git worktree (`git worktree add --detach ...` — required because the primary tree already has `main` checked out); inside it, remove the single demo-seed file with a plain `rm` (never `git rm`, never committed); run `db push --dry-run` then `db push` there to apply the 17 real schema migrations; separately approve and run `migration repair 20260524003809 --status applied` to mark the skipped version as accounted-for in the ledger without executing it; **verify alignment from the primary repository** (not the temporary worktree — see below); **remove the worktree immediately after verification**, well before the Vercel cutover. The committed file in the primary tree is never touched.

### Exact migration repair sequence proposed
```
# (from the temporary worktree, after the 17-migration db push has been approved and applied)
supabase migration repair 20260524003809 --status applied
```
Run only after its own explicit, separate approval — distinct from the approval that authorizes the `db push` itself. **Verification is a separate step, run from a different location** (see below) — `migration list` immediately after `repair`, while still linked from the temporary worktree, would misleadingly show only 17 Local versions.

### Temporary worktree strategy (corrected: detached checkout, plain `rm`, early teardown)
```
git worktree add --detach ../jsg-camsecure-prod-migration-tmp main
cd ../jsg-camsecure-prod-migration-tmp
rm supabase/migrations/20260524003809_seed_demo_data.sql
# ... link, dry-run, push, repair (steps D–H) ...
# switch to the PRIMARY repo, link, and verify (step I) — see "Migration-list verification location" below
git worktree remove ../jsg-camsecure-prod-migration-tmp
git worktree prune
```
`--detach` is mandatory — Git refuses to check the same branch (`main`) out in two worktrees, and the primary tree already has it checked out. The deletion is a plain filesystem `rm`, never `git rm`/committed, so it can never propagate back to `main`. **Teardown now happens immediately after migration + schema verification (step J in the runbook)** — not held through Vercel cutover or smoke testing, because nothing past the migration phase needs a second checkout, and rollback depends only on Vercel env vars, never on the worktree. Zero impact on the primary tree, branch, or commit history at any point.

### Migration-list verification location (corrected — new finding)
Running `supabase migration list` **from the temporary worktree** would show only **17** Local versions (the demo file is genuinely absent from that checkout's `supabase/migrations/`), which would misleadingly look like a Local↔Remote mismatch against the Remote's 18 — even though the production project's ledger is perfectly correct. **Do not verify from there, and do not claim full alignment from that vantage point.** Instead: switch to the **primary working tree** (all 18 files present, exactly as committed), link the CLI there to the **same** production project, and run `migration list` — only from here will Local correctly show all 18 and the alignment check be meaningful.

### Production owner bootstrap sequence
Create `auth.users` for `info@jsgcamsecure.ca` → insert matching `profiles` row with `role = 'owner'`, `id` = that user's id, `organization_id` = the new org, `is_active = true` → confirm owner login works → only then create a separate `admin` account for daily operations. **Reasoning (corrected count): 9 distinct permanent-delete RLS policies are owner-exclusive** (`profiles_delete_owner`, `clients_delete_owner`, `client_contacts_delete_owner`, `technicians_delete_owner`, `service_requests_delete_owner`, `jobs_delete_owner`, `invoices_delete_owner`, `ca_delete`, `notifications_delete`) — an admin-only org could never exercise them. (`organizations_update_owner` and `company_settings_update_owner` were broadened to owner+admin by migration 5 and are correctly excluded from this count — an earlier draft miscounted these as owner-exclusive, totaling 11.)

### Organization fields awaiting confirmation
Legal/business name, real phone, real business address, logo URL, invoice prefix, invoice footer wording, Google Review URL (verify it resolves correctly), tax number, tax rate, primary brand color — full detail with current-vs-placeholder status in [PRODUCTION_BOOTSTRAP_VALUES_TEMPLATE.md](PRODUCTION_BOOTSTRAP_VALUES_TEMPLATE.md). Real email (`info@jsgcamsecure.ca`) is already confirmed by the spec. **`555-9000` and `100 Security Blvd, Suite 200` are flagged placeholders that must not be copied forward.**

### Revised Phase 10U-C execution order
A → B → C → D → E → F → G → H → I → J → K → L → M → N → O → P, exactly as tabulated in §6 above (now 16 steps, was 15) — the migration apply/repair/verify chain is E–I (with **I** corrected to run from the primary repo), worktree teardown is its own step **J** placed immediately after verification (not bundled into the final step), and owner bootstrap/Auth URL/Vercel/redeploy/rollback shift to **K–P**.

### Risks
1. **Running `db push` from the wrong directory** — if the CLI is accidentally run from the primary tree (which still contains the demo migration) instead of the temporary worktree, the demo data would be queued for production. Mitigate by always confirming `pwd` and `supabase status`/linked-project output immediately before any push.
2. **Skipping the dry-run review** — applying 17 files sight-unseen risks missing an unexpected statement. The dry-run + explicit approval gate (steps E–F) exists specifically to catch this.
3. **Conflating the two approval gates** — `db push` (which runs SQL) and `migration repair` (which only edits a ledger) are operationally very different; treating them as one "apply migrations, go" step risks the user approving more than they realized. This plan keeps them as two separate checkpoints (F and the gate before H).
4. **Verifying from the wrong location** *(new — added in 10U-B2)* — running `migration list` from the temporary worktree would show a false "17 vs 18" mismatch, which could trigger unnecessary panic or, worse, an unwarranted attempt to "fix" a non-problem. Mitigate by always switching to the primary repo for the alignment check (step I).
5. **Holding the worktree too long** *(corrected — was "forgetting to delete"; now also "deleting too late"))* — keeping it alive through Vercel cutover/smoke-testing adds a stale, confusing artifact during the highest-stakes phase for no benefit (rollback never depends on it). Mitigate by removing it immediately after verification (step J), not at the very end.
6. **Bootstrapping with the wrong role** — the very mistake the 10U-B1 correction phase exists to prevent. Re-confirm `role = 'owner'` (not `'admin'`) in the INSERT before running it.

### Files changed
- **Updated:** `docs/PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md` (this file — §1 detached-worktree/`rm`/migration-list-location/teardown-timing corrections, §2 `config.toml [db.seed]` requirement added, §3 owner-only policy count corrected from 11 to 9, §6 runbook re-lettered A–P with corrected steps C/I/J, Summary updated)
- **Updated:** `docs/PHASE_10U_B_FRESH_PRODUCTION_SUPABASE_PROVISIONING_PLAN.md` (cross-references to the corrected worktree command, migration-list verification location, and the 9-policy owner-exclusive count — see that file's changelog note at the top)
- No application code, schema, environment variables, secrets, migration files, or `supabase/config.toml` were touched. No `supabase/seeds/` files were created (proposal only, pending approval).

### Build/Lint result
✅ `npm run build` — 38 routes, 0 TypeScript errors
✅ `npm run lint` — 0 errors, 0 warnings

---

**Nothing was created in `supabase/`, no project was created or linked, no migration command was run, no Vercel variables changed, no Auth users created, no data inserted or deleted, nothing committed or pushed. Awaiting your approval before Phase 10U-C execution begins.**
