"use client";

/**
 * EventCaptions — the one-line announcer for the invisible rules. Renders
 * the last turn's event captions (halo / evaporation / Avenger) to EVERY
 * viewer — all four seats and observers — then clears itself. The container
 * stays mounted as a polite live region so screen readers hear each event
 * once; CSS (.event-caption-life) handles the visual fade.
 */

import { useEffect, useRef, useState } from "react";
import type { EventCaptionData } from "@/lib/game/turnEvents";

const CAPTION_LIFE_MS = 4500;

export function EventCaptions({
  captions,
}: {
  captions: readonly EventCaptionData[];
}) {
  const [visible, setVisible] = useState<readonly EventCaptionData[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = captions.map((c) => c.key).join("|");
  const seenKeyRef = useRef("");

  useEffect(() => {
    if (key === seenKeyRef.current) return;
    seenKeyRef.current = key;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    if (captions.length === 0) {
      setVisible([]);
      return;
    }
    setVisible(captions);
    timerRef.current = setTimeout(() => setVisible([]), CAPTION_LIFE_MS);
  }, [key, captions]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <div
      aria-live="polite"
      className="pointer-events-none flex flex-col items-center gap-1 empty:hidden py-1"
      data-testid="event-captions"
    >
      {visible.map((c) => (
        <p key={c.key} className={`event-caption event-caption-${c.tone}`}>
          {c.text}
        </p>
      ))}
    </div>
  );
}
