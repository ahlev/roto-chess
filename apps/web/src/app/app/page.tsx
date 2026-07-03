"use client";

/**
 * Dashboard — "My games": Your turn → Waiting → Setting up → Finished,
 * with mini-board thumbnails and a live badge count in the title.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deserializeState,
  type BoardState,
  type Seat,
} from "@rotochess/engine";
import { RotoBoard } from "@/components/board/RotoBoard";
import { browserClient } from "@/lib/supabase/client";
import { BRAND } from "@/config/brand";

interface CardRow {
  id: string;
  status: string;
  active_seat: number | null;
  state: unknown;
  last_move_at: string | null;
  mySeat: Seat;
  tableName: string;
  result: string | null;
}

export default function DashboardPage() {
  const supabase = browserClient();
  const router = useRouter();
  const [rows, setRows] = useState<CardRow[] | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setSignedIn(false);
      return;
    }
    setSignedIn(true);
    const { data } = await supabase
      .from("game_players")
      .select(
        "seat, games!inner(id, status, active_seat, state, last_move_at, result, tables(name))",
      )
      .eq("user_id", auth.user.id);
    const cards: CardRow[] = (
      (data ?? []) as unknown as Array<{
        seat: number;
        games: {
          id: string;
          status: string;
          active_seat: number | null;
          state: unknown;
          last_move_at: string | null;
          result: string | null;
          tables: { name: string } | null;
        };
      }>
    ).map((r) => ({
      id: r.games.id,
      status: r.games.status,
      active_seat: r.games.active_seat,
      state: r.games.state,
      last_move_at: r.games.last_move_at,
      mySeat: r.seat as Seat,
      tableName: r.games.tables?.name ?? "A table",
      result: r.games.result,
    }));
    setRows(cards);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(() => {
    const yourTurn: CardRow[] = [];
    const waiting: CardRow[] = [];
    const settingUp: CardRow[] = [];
    const finished: CardRow[] = [];
    for (const row of rows ?? []) {
      if (row.status === "lobby") settingUp.push(row);
      else if (row.status === "active" && row.active_seat === row.mySeat)
        yourTurn.push(row);
      else if (row.status === "active") waiting.push(row);
      else finished.push(row);
    }
    // Your turn: oldest wait first; waiting: most recent activity first.
    yourTurn.sort((a, b) =>
      (a.last_move_at ?? "").localeCompare(b.last_move_at ?? ""),
    );
    waiting.sort((a, b) =>
      (b.last_move_at ?? "").localeCompare(a.last_move_at ?? ""),
    );
    return { yourTurn, waiting, settingUp, finished };
  }, [rows]);

  // Title badge: "(2) Roto Chess"
  useEffect(() => {
    const count = sections.yourTurn.length;
    document.title = count > 0 ? `(${count}) ${BRAND.name}` : BRAND.name;
  }, [sections.yourTurn.length]);

  if (!supabase) {
    return (
      <Shell>
        <p className="text-center text-sm text-text-dim">
          This build runs without a backend.{" "}
          <Link className="underline" href="/hotseat">
            Play hotseat
          </Link>{" "}
          instead.
        </p>
      </Shell>
    );
  }
  if (signedIn === false) {
    router.replace("/login?redirect=/app");
    return null;
  }

  return (
    <Shell>
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-sm uppercase tracking-wide text-text-dim">
          My games
        </h2>
        <Link
          href="/app/new"
          className="rounded-full bg-[color:var(--focus-ring)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]"
        >
          Set the board
        </Link>
      </div>
      {rows === null ? (
        <p className="text-sm text-text-dim">Reading the ledger…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-6 text-center">
          <p className="text-text">The board is set. The seats are not.</p>
          <Link
            href="/app/new"
            className="mt-3 inline-block rounded-full bg-[color:var(--focus-ring)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)]"
          >
            Take a seat
          </Link>
        </div>
      ) : (
        <>
          <Section title="Your turn" rows={sections.yourTurn} highlight />
          <Section title="Waiting" rows={sections.waiting} />
          <Section title="Setting up" rows={sections.settingUp} />
          <Section title="Finished" rows={sections.finished} />
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-12">
      <header className="flex items-center justify-between py-4">
        <Link
          href="/"
          className="text-2xl text-text"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          {BRAND.name}
        </Link>
        <Link href="/app/settings" className="text-xs text-text-dim underline">
          Settings
        </Link>
      </header>
      {children}
    </main>
  );
}

function Section({
  title,
  rows,
  highlight = false,
}: {
  title: string;
  rows: CardRow[];
  highlight?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mb-6">
      <h3
        className={`mb-2 text-xs uppercase tracking-wide ${
          highlight ? "text-[color:var(--halo)]" : "text-text-dim"
        }`}
      >
        {title} · {rows.length}
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <GameCard key={row.id} row={row} />
        ))}
      </div>
    </section>
  );
}

function GameCard({ row }: { row: CardRow }) {
  const state = useMemo<BoardState | null>(() => {
    try {
      return deserializeState(JSON.stringify(row.state));
    } catch {
      return null;
    }
  }, [row.state]);

  return (
    <Link
      href={`/app/game/${row.id}`}
      className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 hover:bg-surface-raised"
    >
      <div className="h-24 w-24 shrink-0">
        {state && (
          <RotoBoard
            state={state}
            orientation={row.mySeat}
            interactive={false}
            className="h-full w-full"
          />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm text-text">{row.tableName}</p>
        <p className="text-xs text-text-dim">
          {row.status === "lobby"
            ? "Waiting for seats"
            : row.status === "active"
              ? row.active_seat === row.mySeat
                ? "Your move. The table is watching."
                : "Another seat is thinking"
              : (row.result ?? row.status)}
        </p>
      </div>
    </Link>
  );
}
