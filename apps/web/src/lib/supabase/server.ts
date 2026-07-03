/**
 * Server-side Supabase clients.
 *
 * - serviceClient(): the AUTHORITY client (service role, bypasses RLS).
 *   Node-runtime route handlers only. This file must never be imported
 *   from client components — enforced by the "server-only" import.
 * - authedServerClient(): cookie-bound client for reading the caller's
 *   session (JWT validated server-side).
 */
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  supabaseAnonKey,
  supabaseServiceRoleKey,
  supabaseUrl,
} from "./env";

export function serviceClient(): SupabaseClient {
  const url = supabaseUrl();
  const key = supabaseServiceRoleKey();
  if (!url || !key) {
    throw new Error("Supabase service credentials are not configured");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authedServerClient() {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) {
    throw new Error("Supabase is not configured (demo mode)");
  }
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

/** The authenticated user id, or null. Always validated against Supabase. */
export async function currentUserId(): Promise<string | null> {
  const supabase = await authedServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
