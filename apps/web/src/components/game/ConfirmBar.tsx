"use client";

/**
 * ConfirmBar — the mandatory two-step confirm (UX spec §2.3): notation +
 * drawn path on the board, Cancel / Confirm. Evaporation moves get the
 * amber "Move anyway" treatment (§6.3: warn, never forbid). When the same
 * destination is reachable both ways around with different effects, the
 * via ↻ / via ↺ toggle appears.
 */

import {
  formatSquare,
  moveToToken,
  type BoardState,
  type Move,
} from "@rotochess/engine";

export interface ConfirmBarProps {
  state: BoardState;
  pending: readonly Move[];
  choice: Move | null;
  openingStep: 1 | 2 | null; // null = post-opening
  onChoose: (m: Move) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmBar({
  state,
  pending,
  choice,
  openingStep,
  onChoose,
  onConfirm,
  onCancel,
}: ConfirmBarProps) {
  if (!choice) return null;
  const warning = choice.evaporates === true;
  const token = moveToToken(state, choice);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 ${
        warning
          ? "border-[color:var(--danger)] bg-[#3a2a14]"
          : "border-line bg-surface-raised"
      }`}
      role="dialog"
      aria-label="Confirm move"
    >
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
        <div className="min-w-0">
          <div
            className="truncate text-lg text-text"
            style={{ fontFamily: "var(--font-plex-mono)" }}
          >
            {token}
            {openingStep && (
              <span className="ml-2 text-xs text-text-dim">
                move {openingStep} of 2
              </span>
            )}
          </div>
          {warning && (
            <p className="text-sm text-[color:var(--halo)]">
              This move evaporates your piece — it completes (including any
              capture), then it is removed.
            </p>
          )}
          {choice.earnsHalo && !choice.evaporates && (
            <p className="text-sm text-[color:var(--halo)]">✦ earns a Halo</p>
          )}
          {choice.avenger && (
            <p className="text-sm text-[color:var(--north-red-bright)]">
              Avenger — crosses your meridian penalty-free
            </p>
          )}
          {pending.length > 1 && (
            <div className="mt-1 flex flex-wrap gap-2">
              {pending.map((m, i) => {
                const label = [
                  m.promotion ? `=${m.promotion}` : null,
                  pending.some((p) => p.rotDir !== m.rotDir)
                    ? `via ${m.rotDir === 1 ? "↻" : "↺"}`
                    : null,
                  m.earnsHalo ? "*" : null,
                  m.evaporates ? "†" : null,
                  m.avenger ? "^" : null,
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onChoose(m)}
                    data-testid={`opt-${m.promotion ?? "x"}-${m.rotDir ?? 0}`}
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      m === choice
                        ? "border-[color:var(--focus-ring)] text-text"
                        : "border-line text-text-dim"
                    }`}
                  >
                    {label || `option ${i + 1}`}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-line px-4 py-2 text-sm text-text-dim"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            data-testid="confirm-move"
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              warning
                ? "bg-[color:var(--danger)] text-white"
                : "bg-[color:var(--focus-ring)] text-[color:var(--ink)]"
            }`}
          >
            {warning ? "Move anyway" : "Confirm"}
          </button>
        </div>
      </div>
      <span className="sr-only">
        Confirm move {formatSquare(choice.from)} to {formatSquare(choice.to)}
        {warning ? ". Warning: this move evaporates your piece." : ""}
      </span>
    </div>
  );
}
