"use client";

/**
 * Feedback for the NEWEST committed turn only. Same single-step-growth
 * pattern as useGameSounds: initial loads and multi-turn catch-ups resync
 * silently so history is never re-animated; a shrink (hotseat reset) clears
 * any lingering feedback.
 */

import { useEffect, useRef, useState } from "react";
import type { Turn } from "@rotochess/engine";
import {
  EMPTY_FEEDBACK,
  turnFeedback,
  type TurnFeedback,
} from "@/lib/game/turnEvents";

export function useTurnFeedback(turns: readonly Turn[] | null): TurnFeedback {
  const seen = useRef<number | null>(null);
  const [feedback, setFeedback] = useState<TurnFeedback>(EMPTY_FEEDBACK);

  useEffect(() => {
    if (!turns) return;
    const len = turns.length;
    if (seen.current === null) {
      seen.current = len; // first ready render — adopt, don't animate
      return;
    }
    if (len === seen.current) return;
    const grew = len === seen.current + 1;
    seen.current = len;
    setFeedback(grew ? turnFeedback(turns) : EMPTY_FEEDBACK);
  }, [turns]);

  return feedback;
}
