import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service role key.
 * This client bypasses Row Level Security and has full Admin Auth access.
 *
 * NEVER import this file into a client component or any file that includes
 * "use client". The SUPABASE_SERVICE_ROLE_KEY must not reach the browser.
 *
 * Usage: only inside Next.js Route Handlers and Server Actions that have
 * already verified the calling user is an authenticated admin/owner.
 */
export function createServiceRoleClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const roleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url)     throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!roleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set — this is a server-only environment variable");

  return createClient(url, roleKey, {
    auth: {
      autoRefreshToken:  false,
      persistSession:    false,
    },
  });
}
