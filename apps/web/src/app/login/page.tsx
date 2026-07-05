"use client";

/**
 * Auth — magic link + Google OAuth via Supabase, no passwords. Preserves
 * ?redirect=/join/CODE so an invite link survives the sign-in round trip.
 * In demo mode the page explains itself instead of erroring.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import { BRAND } from "@/config/brand";

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const rawRedirect = params.get("redirect") ?? "/app";
  // Only ever forward to an internal path (never //evil.com).
  const redirect =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/app";
  const supabase = browserClient();

  // Already a member? Don't make them sign in again — forward straight through.
  // This makes any stray redirect to /login seamless rather than a re-login.
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session?.user) router.replace(redirect);
    });
    return () => {
      active = false;
    };
  }, [supabase, router, redirect]);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  if (!supabase) {
    return (
      <div className="text-center text-sm text-text-dim">
        <p>The club is not seating members here just yet.</p>
        <p className="mt-2">
          In the meantime,{" "}
          <Link href="/hotseat" className="underline">
            play hotseat on this device
          </Link>{" "}
          — four chairs, one phone, no account required.
        </p>
      </div>
    );
  }

  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`;

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    setState(error ? "error" : "sent");
  };

  const google = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
  };

  return (
    <div className="w-full max-w-sm space-y-4">
      <button
        type="button"
        onClick={google}
        className="w-full min-h-11 rounded-full bg-[color:var(--focus-ring)] px-4 py-2 font-semibold text-[color:var(--ink)]"
      >
        Continue with Google
      </button>
      <div className="flex items-center gap-3 text-xs text-text-dim">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      {state === "sent" ? (
        <p className="text-center text-sm text-text-dim">
          The link is in your inbox. This page can be closed.
        </p>
      ) : (
        <form onSubmit={sendLink} className="space-y-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-text"
          />
          <button
            type="submit"
            disabled={state === "sending"}
            className="w-full min-h-11 rounded-full border border-line px-4 py-2 text-sm text-text"
          >
            {state === "sending" ? "Sending…" : "Send a magic link"}
          </button>
          {state === "error" && (
            <p className="text-sm text-[color:var(--danger)]">
              The link didn't send. A moment, then try again.
            </p>
          )}
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-6">
        <img
          src="/plates/empty-waiting.webp"
          alt=""
          aria-hidden="true"
          width={800}
          height={800}
          className="w-36 rounded-lg border border-line"
        />
        <h1
          className="text-4xl text-text"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          {BRAND.name}
        </h1>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
