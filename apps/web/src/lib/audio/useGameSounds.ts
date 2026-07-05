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
  ready = true,
}: {
  turns: readonly Turn[];
  checkedNow: boolean;
  ready?: boolean;
}): void {
  const seen = useRef<number | null>(null);
  const checkedRef = useRef(checkedNow);
  checkedRef.current = checkedNow;

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
    for (const m of last.submoves) {
      if (m.captures != null) captured = true;
      if (m.evaporates) evaporated = true;
      if (m.earnsHalo) halo = true;
    }
    // Evaporation replaces the set-down (the piece never really lands);
    // otherwise a capture or an ordinary placement.
    if (evaporated) playCue("evaporation");
    else playCue(captured ? "capture" : "set-down");
    if (halo) playCue("halo");
    if (checkedRef.current) playCue("check-pulse");
  }, [turns, ready]);
}
