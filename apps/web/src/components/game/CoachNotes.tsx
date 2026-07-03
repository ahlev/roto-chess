"use client";

/**
 * Just-in-time coach notes: the first time a rule becomes relevant to THIS
 * player, surface it — never before, never twice. Each note is shown once
 * (localStorage), all switchable off, dismissible. The secretary explains;
 * it never instructs.
 */
import { useEffect, useState } from "react";

const STORE_PREFIX = "roto.coach.";
const OFF_KEY = "roto.coach.off";

function seen(key: string): boolean {
  try {
    return (
      localStorage.getItem(OFF_KEY) === "1" ||
      localStorage.getItem(STORE_PREFIX + key) === "1"
    );
  } catch {
    return true;
  }
}

function markSeen(key: string): void {
  try {
    localStorage.setItem(STORE_PREFIX + key, "1");
  } catch {
    // private mode etc. — the note simply shows again next time
  }
}

export interface CoachNote {
  key: string;
  text: string;
  /** Whether the triggering condition currently holds. */
  active: boolean;
}

export function CoachNotes({ notes }: { notes: CoachNote[] }) {
  const [visible, setVisible] = useState<CoachNote | null>(null);

  useEffect(() => {
    if (visible) return;
    const next = notes.find((n) => n.active && !seen(n.key));
    if (next) setVisible(next);
  }, [notes, visible]);

  if (!visible) return null;
  return (
    <div
      role="note"
      className="mx-auto mb-2 flex max-w-md items-start justify-between gap-3 rounded-lg border border-line bg-surface-raised p-3 text-xs text-text"
    >
      <p className="leading-relaxed">{visible.text}</p>
      <div className="flex shrink-0 flex-col">
        {/* 44px touch targets; the padding is transparent so the visual pill stays light. */}
        <button
          type="button"
          className="flex min-h-11 items-center justify-center text-text-dim"
          onClick={() => {
            markSeen(visible.key);
            setVisible(null);
          }}
        >
          <span className="rounded-full border border-line px-2 py-1">
            Noted
          </span>
        </button>
        <button
          type="button"
          className="min-h-11 rounded-full px-2 py-1 text-[10px] text-text-dim underline"
          onClick={() => {
            try {
              localStorage.setItem(OFF_KEY, "1");
            } catch {
              // ignore
            }
            setVisible(null);
          }}
        >
          No more notes
        </button>
      </div>
    </div>
  );
}
