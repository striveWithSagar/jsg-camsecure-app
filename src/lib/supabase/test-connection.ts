/**
 * Safe connection test — run this manually from a Server Component or API route.
 *
 * Usage (temporary test, delete after confirming):
 *
 *   import { testSupabaseConnection } from "@/lib/supabase/test-connection";
 *   const result = await testSupabaseConnection();
 *   console.log(result);
 *
 * This only reads Supabase system metadata — it never touches app tables.
 */

import { createClient } from "./server";

export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  projectRef: string | null;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    // Safe read: auth.users count (will be 0 in empty project, never throws if connected)
    const { error } = await supabase.from("_supabase_migrations" as never).select("*").limit(1);

    if (error && error.code !== "42P01") {
      // 42P01 = table does not exist — still means connection is alive
      return { connected: false, projectRef: null, error: error.message };
    }

    return {
      connected: true,
      projectRef: process.env.NEXT_PUBLIC_SUPABASE_URL?.split("//")[1]?.split(".")[0] ?? null,
      error: null,
    };
  } catch (err) {
    return {
      connected: false,
      projectRef: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
