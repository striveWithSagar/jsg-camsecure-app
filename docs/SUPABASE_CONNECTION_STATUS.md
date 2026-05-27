# Supabase Connection Status

## Project
| Field | Value |
|---|---|
| Project Name | JSG_CamSercure |
| Project Ref | gbvstrhorjjvlxnfmxcz |
| Project URL | https://gbvstrhorjjvlxnfmxcz.supabase.co |
| Region | us-east-1 |
| DB Version | PostgreSQL 17.6.1 |
| Status | ACTIVE_HEALTHY |

---

## Installed Packages
| Package | Version | Purpose |
|---|---|---|
| `@supabase/supabase-js` | ^2.105.4 | Core Supabase client |
| `@supabase/ssr` | latest | SSR-safe client for Next.js App Router |
| ~~`@supabase/auth-helpers-nextjs`~~ | removed | Deprecated — replaced by `@supabase/ssr` |

---

## Environment Variables
| Variable | File | Status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Set |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` | Set |

> `.env.local` is git-ignored. Never commit it.  
> `.env.local.example` is committed as a template for other developers.  
> Never add `SUPABASE_SERVICE_ROLE_KEY` as a `NEXT_PUBLIC_` variable — it is a secret.

---

## Client Files Created
| File | Purpose |
|---|---|
| `src/lib/supabase/client.ts` | Browser client (`createBrowserClient`) for Client Components |
| `src/lib/supabase/server.ts` | Server client (`createServerClient`) for Server Components / Route Handlers |
| `src/lib/supabase/test-connection.ts` | Temporary safe connection test helper (delete after use) |

---

## What Is NOT Connected Yet
- No database tables created in `public` schema
- No auth integrated (login still uses mock-session.ts)
- No mock-store replaced (still using localStorage context)
- No middleware for session refresh
- No RLS policies
- No Storage buckets
- No app routes import from supabase client files yet

---

## How to Test the Connection
1. In any Server Component or Route Handler, temporarily add:
   ```ts
   import { testSupabaseConnection } from "@/lib/supabase/test-connection";
   const result = await testSupabaseConnection();
   console.log(result); // { connected: true, projectRef: "gbvstrhorjjvlxnfmxcz", error: null }
   ```
2. Remove after confirming.

---

## Next Safe Step
**Phase 2 — Schema design and first migration**

Design and apply the database schema for the `requests` table:
- Mirror the shape of `MockRequestItem` from `src/lib/mock-store.tsx`
- Add RLS policies (auth-gated reads/writes)
- Seed with the 5 rows from `MOCK_REQUESTS` in `src/lib/constants.ts`
- Do not replace the mock store yet — run both in parallel

Approval required before proceeding.
