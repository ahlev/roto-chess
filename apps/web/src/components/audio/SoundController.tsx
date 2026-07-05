"use client";

/**
 * Global audio wiring, mounted once in the root layout:
 *  - warms the AudioContext on the first user gesture (browser autoplay
 *    policy — nothing can sound before the player interacts), and
 *  - maps attention events to their cues (your-turn, chat). The recurring
 *    chat-nudge stays deliberately silent — a recurring sound would nag.
 * Renders nothing.
 */
import { useEffect } from "react";
import { onAttention } from "@/components/game/attention";
import { unlockAudio, playCue } from "@/lib/audio/engine";

export function SoundController() {
  useEffect(() => {
    const unlock = () => unlockAudio();
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);

    const off = onAttention((e) => {
      if (e === "your-turn") playCue("your-turn");
      else if (e === "chat-receive") playCue("chat-tick");
      // "chat-nudge" — visual only, no sound.
    });

    return () => {
      window.removeEventListener("pointerdown", unlock, opts);
      window.removeEventListener("keydown", unlock, opts);
      window.removeEventListener("touchstart", unlock, opts);
      off();
    };
  }, []);

  return null;
}
