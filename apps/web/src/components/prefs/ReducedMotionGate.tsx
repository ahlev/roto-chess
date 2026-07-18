"use client";

/**
 * Applies the in-app "Reduce motion" preference (profiles.reduced_motion) as
 * a root data attribute — the CSS gate in globals.css collapses animation
 * next to the OS prefers-reduced-motion layer. A localStorage echo applies
 * instantly on load (no animated flash while the profile fetch is in
 * flight); the profile remains the source of truth and refreshes the echo.
 */

import { useEffect } from "react";
import { browserClient } from "@/lib/supabase/client";

const STORAGE_KEY = "roto.reduced-motion";

export function applyReducedMotion(on: boolean): void {
  const root = document.documentElement;
  if (on) root.setAttribute("data-reduced-motion", "1");
  else root.removeAttribute("data-reduced-motion");
  try {
    localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // Private mode etc. — the attribute still applies for this page life.
  }
}

export function ReducedMotionGate() {
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") applyReducedMotion(true);
    } catch {
      // ignore
    }
    const supabase = browserClient();
    if (!supabase) return; // demo mode — OS media query still applies
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("reduced_motion")
        .eq("id", user.id)
        .single();
      if (data) applyReducedMotion(Boolean(data.reduced_motion));
    });
  }, []);
  return null;
}
