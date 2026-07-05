"use client";

/**
 * The sound on/off control, lives in the site header so it's reachable
 * everywhere. Reflects and persists the engine's enabled state. Icon inherits
 * currentColor, so it reads correctly in both the dark chrome and the paper
 * tone. Defaults to the "on" glyph on first paint to avoid a hydration flip;
 * the effect corrects it from the stored preference.
 */
import { useEffect, useState } from "react";
import { isSoundEnabled, setSoundEnabled, onSoundChange } from "@/lib/audio/engine";

export function SoundToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(isSoundEnabled());
    return onSoundChange(setOn);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setSoundEnabled(!on)}
      aria-label={on ? "Mute sound" : "Unmute sound"}
      aria-pressed={!on}
      title={on ? "Sound on" : "Sound off"}
      className={
        className ?? "inline-flex items-center opacity-70 hover:opacity-100"
      }
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 9v6h4l5 4V5L8 9H4z" />
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
