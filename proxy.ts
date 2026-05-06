import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

/**
 * Refreshes the Supabase auth cookie before each navigation. Without this,
 * server components see a stale session.
 *
 * Next.js 16 renamed middleware → proxy. The function name is `proxy`.
 * Runtime is nodejs; edge runtime is not supported in proxy.
 */
export async function proxy(request: NextRequest) {
  if (!hasSupabaseEnv()) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touch the user record to trigger a refresh if needed. Don't gate routing
  // on this — login/logout flow is handled by /login and /api/auth/* routes.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/cron|.*\\.svg|.*\\.png|.*\\.webmanifest).*)"],
};
