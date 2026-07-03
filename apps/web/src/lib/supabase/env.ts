/**
 * Supabase environment detection. Without env vars the app runs in DEMO
 * MODE — local hotseat play only, with a graceful banner instead of a
 * crash. The founder's GOING-LIVE.md wiring flips this on.
 */

export function supabaseUrl(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
}

export function supabaseAnonKey(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;
}

export function isDemoMode(): boolean {
  return !supabaseUrl() || !supabaseAnonKey();
}
