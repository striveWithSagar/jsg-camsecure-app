# Supabase Environment Variable Check — CamSecure

---

## Current Environment Variables

| Variable | File | Status | Used In |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | **Set** | `client.ts`, `server.ts` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` | **Set** | `client.ts`, `server.ts` |

> Note: This project uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`).  
> Both `client.ts` and `server.ts` read the same variable name — they are consistent.

---

## Client File Confirmation

### `src/lib/supabase/client.ts`
```ts
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
```
Reads: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ✓

### `src/lib/supabase/server.ts`
```ts
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
```
Reads: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ✓

Both files are consistent. No mismatch.

---

## What Future Developers Must Add Locally

1. Copy `.env.local.example` to `.env.local`
2. Fill in `NEXT_PUBLIC_SUPABASE_URL` — find it in: **Supabase Dashboard → Project Settings → API → Project URL**
3. Fill in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — find it in: **Supabase Dashboard → Project Settings → API → Project API Keys → Publishable** (the `sb_publishable_...` format key)
4. Restart the dev server (`npm run dev`)

> **Never use the `service_role` key on the frontend.** It bypasses all RLS policies and must never be `NEXT_PUBLIC_`.  
> If you need server-side privileged access later, add `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix) and use it only in Server Components or Route Handlers.

---

## What Is NOT in the Environment Yet

These variables do not exist and are not needed until the phases listed:

| Variable | Needed When | Phase |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Admin-only server operations, seeding | Phase 3 (optional) |
| `NEXT_PUBLIC_SITE_URL` | Auth redirects (email confirmation) | Phase with real auth |
| `STRIPE_SECRET_KEY` | Invoice payment processing | Phase 10 |
| `STRIPE_PUBLISHABLE_KEY` | Client payment form | Phase 10 |
| `RESEND_API_KEY` | Email notifications | Phase 10 |

---

## `.env.local` Rules

| Rule | Reason |
|---|---|
| Never commit `.env.local` | Contains API keys — `.gitignore` covers this |
| Always commit `.env.local.example` | Template for new developers |
| Never prefix secrets with `NEXT_PUBLIC_` | Exposes them in the browser bundle |
| Restart dev server after any `.env.local` change | Next.js caches env at startup |

---

## Current `.env.local.example` Contents

```env
# Supabase connection — copy this file to .env.local and fill in real values
# Project: JSG_CamSercure (ref: gbvstrhorjjvlxnfmxcz)
# Values are found in: Supabase Dashboard → Project Settings → API / Connect

NEXT_PUBLIC_SUPABASE_URL=https://gbvstrhorjjvlxnfmxcz.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key-here

# Never add SUPABASE_SERVICE_ROLE_KEY here — that is a secret and must never be NEXT_PUBLIC_
```
