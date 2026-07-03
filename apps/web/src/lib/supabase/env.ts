/**
 * Supabase environment detection. Without env vars the app runs in DEMO
 * MODE — local hotseat play only, with a graceful banner instead of a
 * crash. The founder's GOING-LIVE.md wiring flips this on.
 */

export function supabaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  // A half-wired .env.local (placeholders, typos) must degrade to demo
  // mode, not crash every networked route with an invalid-URL client.
  if (!url || !url.startsWith("https://")) return null;
  return url;
}

export function supabaseAnonKey(): string | null {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;
  if (!key || key.includes("PASTE_")) return null;
  return key;
}

export function isDemoMode(): boolean {
  return !supabaseUrl() || !supabaseAnonKey();
}
