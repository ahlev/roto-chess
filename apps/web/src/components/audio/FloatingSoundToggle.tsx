"use client";

/**
 * A small but bold, always-present sound control in the bottom-left corner.
 * The button mutes/unmutes (and its "on" tap plays a confirmation cue, which
 * also doubles as the gesture that unlocks the audio engine). Hovering — or
 * keyboard-focusing — the control slides out a volume level next to it, so the
 * loudness is tunable without leaving the corner. Both persist via the engine.
 */
import { useEffect, useState } from "react";
import {
  isSoundEnabled,
  setSoundEnabled,
  onSoundChange,
  getVolume,
  setVolume,
  onVolumeChange,
  playCue,
} from "@/lib/audio/engine";

export function FloatingSoundToggle() {
  const [on, setOn] = useState(true);
  const [vol, setVol] = useState(1);

  useEffect(() => {
    setOn(isSoundEnabled());
    setVol(getVolume());
    const offSound = onSoundChange(setOn);
    const offVol = onVolumeChange(setVol);
    return () => {
      offSound();
      offVol();
    };
  }, []);

  const toggle = () => {
    const next = !on;
    setSoundEnabled(next);
    if (next) playCue("your-turn"); // audible confirmation that sound is on
  };

  const onSlide = (v: number) => {
    setVol(v); // reflect immediately; the engine ramps + persists
    setVolume(v);
  };

  return (
    <div className="group fixed bottom-3 left-3 z-30 flex items-center">
      <button
        type="button"
        onClick={toggle}
        aria-label={on ? "Mute sound" : "Unmute sound"}
        aria-pressed={!on}
        title={on ? "Sound on — tap to mute" : "Sound off — tap to unmute"}
        className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur transition ${
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

      {/* Volume level — collapsed until the control is hovered or focused. */}
      <div className="overflow-hidden opacity-0 transition-all duration-200 [max-width:0px] group-hover:opacity-100 group-hover:[max-width:9rem] focus-within:opacity-100 focus-within:[max-width:9rem]">
        <div className="ml-2 flex items-center rounded-full border border-line bg-surface/90 px-3 py-2 shadow-lg backdrop-blur">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(vol * 100)}
            onChange={(e) => onSlide(Number(e.target.value) / 100)}
            onPointerUp={() => on && playCue("set-down")}
            onKeyUp={() => on && playCue("set-down")}
            aria-label="Sound volume"
            className="h-1 w-24 cursor-pointer accent-[color:var(--focus-ring)]"
          />
        </div>
      </div>
    </div>
  );
}
