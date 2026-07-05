"use client";

/**
 * The header bell: it appears precisely when at least one game is waiting on
 * YOUR move, carries a badge counting the turns you haven't looked at yet, and
 * opens a small panel listing each waiting table with a "Jump" straight to that
 * board. Opening the panel acknowledges the turns (the badge clears); a new
 * move in any game re-raises it. Hidden entirely when nothing needs you.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTurnNotifications } from "@/lib/notifications/useTurnNotifications";

export function TurnNotificationBell() {
  const { items, unseen, markSeen } = useTurnNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) markSeen(); // opening the panel acknowledges the waiting turns
  };

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        type="button"
        onClick={toggle}
        aria-label={
          unseen > 0
            ? `${unseen} game${unseen === 1 ? "" : "s"} waiting on your move`
            : "Games waiting on your move"
        }
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unseen > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-[color:var(--ink)]"
            style={{ background: "var(--focus-ring)" }}
          >
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-50 w-72 overflow-hidden rounded-lg border border-line bg-surface-raised shadow-xl"
        >
          <p className="border-b border-line px-3 py-2 text-xs uppercase tracking-wide text-text-dim">
            Your move
          </p>
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.map((it) => (
              <li
                key={it.gameId}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-text">
                  {it.tableName}
                </span>
                <Link
                  href={`/app/game/${it.gameId}`}
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-[color:var(--ink)]"
                  style={{ background: "var(--focus-ring)" }}
                >
                  Jump →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
