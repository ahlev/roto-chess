"use client";

/**
 * A small but bold, always-present sound control in the bottom-left corner.
 * Solid pill so it's easy to find and tap, with an unmistakable on/off glyph.
 * Turning it ON plays a short confirmation cue — instant proof that audio is
 * working (and it doubles as the first user gesture that unlocks the engine).
 * Persists via the engine; reflects state live through onSoundChange.
 */
import { useEffect, useState } from "react";
import {
  isSoundEnabled,
  setSoundEnabled,
  onSoundChange,
  playCue,
} from "@/lib/audio/engine";

export function FloatingSoundToggle() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(isSoundEnabled());
    return onSoundChange(setOn);
  }, []);

  const toggle = () => {
    const next = !on;
    setSoundEnabled(next);
    if (next) playCue("your-turn"); // audible confirmation that sound is on
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={on ? "Mute sound" : "Unmute sound"}
      aria-pressed={!on}
      title={on ? "Sound on — tap to mute" : "Sound off — tap to unmute"}
      className={`fixed bottom-3 left-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur transition ${
        on
          ? "border-[color:var(--focus-ring)]/60 bg-surface-raised text-text"
          : "border-line bg-surface text-text-dim"
      }`}
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
        {on ? (
          <>
            <path d="M16 9a4 4 0 0 1 0 6" />
            <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
          </>
        ) : (
          <path d="M22 9l-5 6M17 9l5 6" />
        )}
      </svg>
    </button>
  );
}
