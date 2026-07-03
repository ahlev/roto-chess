/**
 * Session refresh middleware (Supabase SSR pattern): keeps auth cookies
 * fresh on navigation. No-op in demo mode.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Mirror lib/supabase/env.ts: half-wired env (placeholders) = demo mode.
  if (!url || !url.startsWith("https://") || !key || key.includes("PASTE_")) {
    return NextResponse.next(); // demo mode
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  await supabase.auth.getUser(); // refreshes expired tokens
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/join/:path*", "/auth/:path*", "/api/:path*"],
};
