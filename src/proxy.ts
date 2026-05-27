import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Admin dashboard routes — unauthenticated requests are redirected to /login/admin
const ADMIN_ROUTES = [
  "/dashboard",
  "/requests",
  "/jobs",
  "/clients",
  "/technicians",
  "/invoices",
  "/settings",
];

export async function proxy(request: NextRequest) {
  // Start with a pass-through response so cookies can be mutated below
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write refreshed tokens back to both request and response
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the JWT against Supabase Auth — safe for server-side checks.
  // Never use getSession() here: it only reads the cookie and cannot verify the token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdminRoute = ADMIN_ROUTES.some(
    (r) => path === r || path.startsWith(r + "/")
  );

  if (isAdminRoute && !user) {
    return NextResponse.redirect(new URL("/login/admin", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
