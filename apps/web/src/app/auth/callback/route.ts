/**
 * OAuth / magic-link callback: exchange the code for a session, ensure a
 * profile row exists, then resume the caller's journey (?redirect=…).
 */
import { NextResponse } from "next/server";
import { authedServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirect = url.searchParams.get("redirect") ?? "/app";
  // Only ever redirect within the app.
  const safeRedirect = redirect.startsWith("/") ? redirect : "/app";

  if (code) {
    const supabase = await authedServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await supabase
        .from("profiles")
        .upsert(
          {
            id: data.user.id,
            display_name:
              (data.user.user_metadata?.full_name as string | undefined) ??
              data.user.email?.split("@")[0] ??
              "Player",
          },
          { onConflict: "id", ignoreDuplicates: true },
        );
    }
  }
  return NextResponse.redirect(new URL(safeRedirect, url.origin));
}
