# Production Bootstrap Values Template — JSG CamSecure

**Status:** Awaiting user confirmation. Nothing in this file has been written to any database.
**Purpose:** A single checklist of every real-world value that must be confirmed (or explicitly left `NULL`) before seeding the new production `organizations` / `company_settings` rows in Phase 10U-C.

**Do not copy current dev-project values marked "PLACEHOLDER — do not carry forward" below.** They were inserted by the demo-seed migration on 2026-05-24 and are not real business data.

---

## Organization fields

| Field | Current value in dev project | Status | Confirmed production value |
|---|---|---|---|
| Legal / business name | `JSG CamSecure` | Looks real — confirm it's the exact legal/trading name to display | _awaiting confirmation_ |
| Real email | `admin@jsg.com` | **PLACEHOLDER — do not carry forward.** Spec already names the real address | **`info@jsgcamsecure.ca`** ✅ (provided in spec) |
| Real phone | `555-9000` | **PLACEHOLDER — do not carry forward.** Classic fictional/demo phone format | _awaiting confirmation — use `NULL` until provided_ |
| Real business address | `100 Security Blvd, Suite 200` | **PLACEHOLDER — do not carry forward.** Generic demo address | _awaiting confirmation — use `NULL` until provided_ |
| Logo URL / path | `NULL` | Not set in dev either | _awaiting confirmation — use `NULL` until brand assets exist_ |

## Company settings fields

| Field | Current value in dev project | Status | Confirmed production value |
|---|---|---|---|
| Invoice prefix | `INV` | Looks like a reasonable real default — confirm | _awaiting confirmation (default `INV` if no objection)_ |
| Invoice footer note | `JSG CamSecure — Professional Security Installation` | Looks like real business copy — confirm wording | _awaiting confirmation_ |
| Google Review URL | `https://share.google/oUog5JNnrv9slovfN` | Live, real-looking URL — confirm it resolves to the correct business listing | _awaiting confirmation (carry forward if confirmed correct)_ |
| Tax number (ABN / business number) | `NULL` | Not set | _awaiting confirmation — use `NULL` if not applicable/not yet registered_ |
| Tax rate | `NULL` | Not set | _awaiting confirmation — use `NULL` until the real rate is confirmed (do not invent a number — invoices store the rate at creation time, so an incorrect seed value would silently misprice every invoice until corrected)_ |
| Primary brand color | `NULL` | Not set | _awaiting confirmation — use `NULL` until brand guidelines exist_ |

---

## Rule for any field not confirmed by go-live

**Use `NULL`, never a guessed or placeholder value.** Every field above is nullable in the schema (`organizations.phone`, `.address`, `.logo_url`; `company_settings.abn`, `.tax_rate`, `.primary_color`, `.logo_url` are all nullable columns — confirmed in `20260524001041_create_base_schema.sql`). A `NULL` is visibly "not yet configured" and safe to fill in later through the in-app Settings page; a guessed value (e.g., a made-up phone number or tax rate) would look real, get displayed to clients on invoices/communications, and could cause real-world harm (wrong tax charged, wrong contact number printed) until someone notices and corrects it.

---

## What this template explicitly excludes

Per the Phase 10U-B1 spec, this manifest contains **only** organization/branding values. It must never include:
- Auth passwords or password hashes
- Supabase API keys / service-role keys / any secret values
- Test or seed user accounts
- Demo clients, jobs, invoices, requests, announcements, or notifications

---

## Next step

Once the user fills in the "Confirmed production value" column (or explicitly approves `NULL` for any unconfirmed field), this template becomes the literal input to the `organizations` + `company_settings` INSERT statements described in §4 of [PHASE_10U_B_FRESH_PRODUCTION_SUPABASE_PROVISIONING_PLAN.md](PHASE_10U_B_FRESH_PRODUCTION_SUPABASE_PROVISIONING_PLAN.md) and the bootstrap sequence in [PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md](PHASE_10U_B1_PRODUCTION_MIGRATION_PACKAGING_CORRECTION.md).
