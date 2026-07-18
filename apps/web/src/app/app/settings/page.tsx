"use client";

/**
 * Settings — display name, email notifications, reduced motion, coach
 * toggle, vacation flag, sign out, delete account. Quiet, one card.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { applyReducedMotion } from "@/components/prefs/ReducedMotionGate";

interface Prefs {
  display_name: string;
  email_notifications: boolean;
  reduced_motion: boolean;
  coach_enabled: boolean;
  vacation_until: string | null;
}

export default function SettingsPage() {
  const supabase = browserClient();
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    // Persisted-session gate (not getUser's network check) so a signed-in
    // member is never bounced to /login by a transient validation failure.
    void supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) {
        router.replace("/login?redirect=/app/settings");
        return;
      }
      setUserId(user.id);
      const { data: row } = await supabase
        .from("profiles")
        .select(
          "display_name, email_notifications, reduced_motion, coach_enabled, vacation_until",
        )
        .eq("id", user.id)
        .single();
      if (row) setPrefs(row as Prefs);
    });
  }, [supabase, router]);

  const save = useCallback(
    async (next: Prefs) => {
      if (!supabase || !userId) return;
      setPrefs(next);
      await supabase.from("profiles").update(next).eq("id", userId);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
    [supabase, userId],
  );

  if (!supabase) {
    return (
      <Shell>
        <p className="text-sm text-text-dim">
          The club is not seating members here just yet — nothing to set.
        </p>
      </Shell>
    );
  }
  if (!prefs) {
    return (
      <Shell>
        <p className="text-sm text-text-dim">Fetching the ledger…</p>
      </Shell>
    );
  }

  const row = "flex items-center justify-between gap-4 py-3";

  return (
    <Shell>
      <div className="rounded-lg border border-line bg-surface p-4 divide-y divide-[color:var(--line)]">
        <div className={row}>
          <label htmlFor="display-name" className="text-sm text-text">
            Display name
          </label>
          <input
            id="display-name"
            value={prefs.display_name ?? ""}
            onChange={(e) => setPrefs({ ...prefs, display_name: e.target.value })}
            onBlur={() => void save(prefs)}
            className="w-40 rounded-lg border border-line bg-surface-raised px-2 py-1 text-sm text-text"
          />
        </div>
        <Toggle
          label="Email me when it's my move"
          checked={prefs.email_notifications}
          onChange={(v) => void save({ ...prefs, email_notifications: v })}
        />
        <Toggle
          label="Reduce motion"
          checked={prefs.reduced_motion}
          onChange={(v) => {
            applyReducedMotion(v); // live — no reload needed
            void save({ ...prefs, reduced_motion: v });
          }}
        />
        <Toggle
          label="Coach notes (first-time rule hints)"
          checked={prefs.coach_enabled}
          onChange={(v) => void save({ ...prefs, coach_enabled: v })}
        />
        <div className={row}>
          <label htmlFor="vacation" className="text-sm text-text">
            Away until
            <span className="block text-xs text-text-dim">
              A suitcase appears at your seats; the table waits kindly.
            </span>
          </label>
          <input
            id="vacation"
            type="date"
            value={prefs.vacation_until?.slice(0, 10) ?? ""}
            onChange={(e) =>
              void save({
                ...prefs,
                vacation_until: e.target.value || null,
              })
            }
            className="rounded-lg border border-line bg-surface-raised px-2 py-1 text-sm text-text"
          />
        </div>
      </div>
      {saved && <p className="pt-2 text-xs text-text-dim">Noted.</p>}

      <div className="mt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/");
          }}
          className="rounded-full border border-line px-4 py-2 text-sm text-text-dim"
        >
          Sign out
        </button>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-full border border-[color:var(--danger)] px-4 py-2 text-sm text-[color:var(--danger)]"
          >
            Delete account…
          </button>
        ) : (
          <div className="rounded-lg border border-[color:var(--danger)] p-3 text-center">
            <p className="pb-2 text-sm text-text">
              This removes your account and empties your seats. Finished games
              keep their records. Certain?
            </p>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/account/delete", { method: "POST" });
                  await supabase.auth.signOut();
                  router.push("/");
                }}
                className="rounded-full bg-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
              >
                Delete it
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-full border border-line px-4 py-2 text-sm text-text-dim"
              >
                Keep it
              </button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-3 text-sm text-text">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-12">
      <SiteHeader
        home="/app"
        links={[{ href: "/app", label: "My games" }]}
        auth={false}
      />
      <h1 className="pb-4 text-sm uppercase tracking-wide text-text-dim">
        Settings
      </h1>
      {children}
    </main>
  );
}
