/**
 * Browser Supabase client (anon key; RLS applies). Null in demo mode.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDemoMode, supabaseAnonKey, supabaseUrl } from "./env";

let cached: SupabaseClient | null = null;

export function browserClient(): SupabaseClient | null {
  if (isDemoMode()) return null;
  cached ??= createBrowserClient(supabaseUrl() as string, supabaseAnonKey() as string);
  return cached;
}
