import { useEffect, useRef } from "react";
import type { Turn } from "@rotochess/engine";
import { playCue } from "./engine";

/**
 * Fires move cues as the committed-turn list grows. Keyed on length so it
 * works identically for hotseat (synchronous local turns) and the online room
 * (canonical turns replayed from the server, so you hear opponents move too).
 *
 * Only a single-step growth (len === seen + 1) plays: initial loads and
 * catch-up bursts resync silently, so history is never re-sounded. `ready`
 * guards the async online case where the list is null until the first fetch.
 */
export function useGameSounds({
  turns,
  checkedNow,
  staged = false,
  ready = true,
}: {
  turns: readonly Turn[];
  checkedNow: boolean;
  /** The opening's first submove is placed but not yet committed. */
  staged?: boolean;
  ready?: boolean;
}): void {
  const seen = useRef<number | null>(null);
  const checkedRef = useRef(checkedNow);
  checkedRef.current = checkedNow;
  const wasStaged = useRef(false);

  // A softer set-down when the opening's first submove is placed, so the very
  // first tap of a game gives feedback (the full cue waits for the commit).
  useEffect(() => {
    if (staged && !wasStaged.current) playCue("set-down", 0.7);
    wasStaged.current = staged;
  }, [staged]);

  useEffect(() => {
    if (!ready) return;
    const len = turns.length;
    if (seen.current === null) {
      seen.current = len; // first ready render — adopt, don't sound
      return;
    }
    const grew = len === seen.current + 1;
    seen.current = len;
    if (!grew) return; // load / reset / multi-step catch-up — resync only

    const last = turns[len - 1];
    if (!last) return;
    let captured = false;
    let halo = false;
    let evaporated = false;
    let avenger = false;
    for (const m of last.submoves) {
      if (m.captures != null) captured = true;
      if (m.evaporates) evaporated = true;
      // Mixed-signal rule (§6.3): a halo earned on an evaporating move is
      // not celebrated — the evaporation owns the moment.
      if (m.earnsHalo && !m.evaporates) halo = true;
      if (m.avenger) avenger = true;
    }
    // Evaporation replaces the set-down (the piece never really lands);
    // otherwise a capture or an ordinary placement.
    if (evaporated) playCue("evaporation");
    else playCue(captured ? "capture" : "set-down");
    // The Avenger cue tells the whole revenge story (its capture earned a
    // halo too — one fanfare, not two).
    if (avenger) playCue("avenger");
    else if (halo) playCue("halo");
    if (checkedRef.current) playCue("check-pulse");
  }, [turns, ready]);
}
