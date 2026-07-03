"use client";

/**
 * Join via invite link or code. Shows the game preview before the auth
 * gate; ?redirect survives the sign-in round trip.
 */
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SEAT_COMPASS, type Seat } from "@rotochess/engine";
import { browserClient } from "@/lib/supabase/client";
import { BRAND } from "@/config/brand";

const SEAT_NAME: Record<Seat, string> = {
  1: "North",
  2: "East",
  3: "South",
  4: "West",
};

export default function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase().replace(/^ROTO-?/u, "").slice(0, 5);
  const router = useRouter();
  const supabase = browserClient();
  const [openSeats, setOpenSeats] = useState<Seat[] | null>(null);
  const [tableName, setTableName] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
    });
    // Honest preview (works before auth): table name + truly open seats.
    void supabase
      .rpc("preview_game", { p_code: code })
      .then(({ data }) => {
        const row = (
          data as Array<{
            table_name: string;
            taken_seats: number[];
            game_status: string;
          }> | null
        )?.[0];
        if (!row || row.game_status !== "lobby") {
          setStale(true);
          setOpenSeats([]);
          return;
        }
        setTableName(row.table_name);
        setOpenSeats(
          ([1, 2, 3, 4] as const).filter(
            (s) => !row.taken_seats.includes(s),
          ),
        );
      });
  }, [supabase, code]);

  if (!supabase) {
    return (
      <Shell>
        <p className="text-sm text-text-dim">
          The club is not seating members here just yet.{" "}
          <Link className="underline" href="/hotseat">
            Play hotseat
          </Link>{" "}
          on this device instead — four chairs, one phone.
        </p>
      </Shell>
    );
  }

  const take = async (seat: Seat) => {
    if (!signedIn) {
      router.push(`/login?redirect=${encodeURIComponent(`/join/${code}`)}`);
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("join_game", {
      p_code: code,
      p_seat: seat,
    });
    if (rpcError) {
      setError(
        rpcError.message.includes("SEAT_TAKEN")
          ? "That seat just filled. Pick another."
          : rpcError.message.includes("GAME_NOT_JOINABLE")
            ? "This table isn't seating — the code may be stale."
            : "The table wobbled. Try again.",
      );
      setBusy(false);
      return;
    }
    router.push(`/app/game/${data as string}`);
  };

  if (stale) {
    return (
      <Shell>
        <p className="text-center text-sm text-text-dim">
          This code isn't seating — the table may be full, finished, or the
          code mistyped.
        </p>
        <p
          className="py-3 text-center text-2xl tracking-widest text-text-dim"
          style={{ fontFamily: "var(--font-plex-mono)" }}
        >
          ROTO-{code}
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-center text-sm text-text-dim">
        You're wanted at the board.{" "}
        {tableName ? `${tableName} is forming.` : "A Roto game is forming."}
      </p>
      <p
        className="py-3 text-center text-3xl tracking-widest text-text"
        style={{ fontFamily: "var(--font-plex-mono)" }}
      >
        ROTO-{code}
      </p>
      {error && (
        <p className="pb-2 text-center text-sm text-[color:var(--danger)]">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {(openSeats ?? []).map((seat) => (
          <button
            key={seat}
            type="button"
            disabled={busy || signedIn === null}
            onClick={() => take(seat)}
            className="min-h-11 rounded-lg border border-line p-3 text-sm text-text hover:bg-surface-raised disabled:opacity-50"
          >
            Take {SEAT_NAME[seat]} ({SEAT_COMPASS[seat]})
          </button>
        ))}
      </div>
      {openSeats !== null && openSeats.length === 0 && !stale && (
        <p className="pt-3 text-center text-xs text-text-dim">
          All four seats are warm.
        </p>
      )}
      {!signedIn && signedIn !== null && (
        <p className="pt-3 text-center text-xs text-text-dim">
          You'll sign in first — the seat will be waiting.
        </p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1
        className="pb-6 text-center text-3xl text-text"
        style={{ fontFamily: "var(--font-instrument-serif)" }}
      >
        {BRAND.name}
      </h1>
      {children}
    </main>
  );
}
