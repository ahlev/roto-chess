"use client";

/**
 * Create table — three fields max: optional name, pick your seat on a mini
 * annulus, go. Lands in the lobby with the invite front and center.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SEAT_COMPASS, initialState, type Seat } from "@rotochess/engine";
import { RotoBoard } from "@/components/board/RotoBoard";
import { SiteHeader } from "@/components/brand/SiteHeader";

const SEAT_NAME: Record<Seat, string> = {
  1: "North",
  2: "East",
  3: "South",
  4: "West",
};

const SEAT_TEXT: Record<Seat, string> = {
  1: "text-[color:var(--north-red-bright)]",
  2: "text-[color:var(--east-black-bright)]",
  3: "text-[color:var(--south-blue-bright)]",
  4: "text-[color:var(--west-gold-bright)]",
};

export default function NewTablePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [seat, setSeat] = useState<Seat>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tableName: name || undefined, seat }),
    });
    if (res.status === 401) {
      router.push("/login?redirect=/app/new");
      return;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "The table wobbled. Try again.");
      setBusy(false);
      return;
    }
    const { gameId } = (await res.json()) as { gameId: string };
    router.push(`/app/game/${gameId}`);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4">
      <SiteHeader home="/app" links={[{ href: "/app", label: "My games" }]} />
      <h1 className="pb-4 text-lg text-text">Set the board</h1>
      <label className="pb-1 text-xs text-text-dim" htmlFor="table-name">
        Table name (optional)
      </label>
      <input
        id="table-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`The ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()]} Board`}
        className="mb-4 rounded-lg border border-line bg-surface px-3 py-2 text-text"
      />
      <p className="pb-2 text-xs text-text-dim">Your seat</p>
      <div className="mb-2 grid grid-cols-4 gap-2">
        {([1, 2, 3, 4] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeat(s)}
            className={`rounded-lg border p-2 text-sm ${SEAT_TEXT[s]} ${
              seat === s
                ? "border-[color:var(--focus-ring)] bg-surface-raised"
                : "border-line"
            }`}
          >
            {SEAT_COMPASS[s]}
            <span className="block text-[10px] text-text-dim">
              {SEAT_NAME[s]}
            </span>
          </button>
        ))}
      </div>
      <div className="mx-auto mb-4 w-48">
        <RotoBoard
          state={initialState()}
          orientation={seat}
          interactive={false}
          className="w-full"
        />
      </div>
      {error && (
        <p className="pb-2 text-sm text-[color:var(--danger)]">{error}</p>
      )}
      <button
        type="button"
        onClick={create}
        disabled={busy}
        className="min-h-11 rounded-full bg-[color:var(--focus-ring)] px-4 py-2 font-semibold text-[color:var(--ink)]"
      >
        {busy ? "Setting the board…" : "Set the board"}
      </button>
    </main>
  );
}
