import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { globalSearch } from "@/lib/data/global-search";

// Matches the (dashboard) layout's ADMIN_ROLES — every role that can see the
// TopBar (and therefore this search box) must be able to use it.
const SEARCH_ROLES = new Set(["admin", "owner", "dispatcher"]);

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !SEARCH_ROLES.has(profile.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const query = req.nextUrl.searchParams.get("q") ?? "";
  const results = await globalSearch(query);

  return NextResponse.json(results, { status: 200 });
}
