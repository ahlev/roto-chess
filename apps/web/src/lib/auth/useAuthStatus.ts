"use client";

/**
 * Auth status for chrome (the header's sign-in vs. account affordance).
 * Reads the current member once, then follows auth-state changes live so a
 * sign-in / sign-out anywhere updates every header without a reload. In demo
 * mode (no Supabase client) there is no club to sign into — resolves to
 * signed-out immediately.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";

export interface AuthStatus {
  /** null while resolving; false in demo/signed-out; true with a live session. */
  signedIn: boolean | null;
  email: string | null;
  /** Sign out (if a client exists), then return to the public front door. */
  signOut: () => Promise<void>;
}

export function useAuthStatus(): AuthStatus {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = browserClient();
    if (!supabase) {
      setSignedIn(false);
      setEmail(null);
      return;
    }
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setSignedIn(Boolean(data.user));
      setEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = browserClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/");
  };

  return { signedIn, email, signOut };
}
