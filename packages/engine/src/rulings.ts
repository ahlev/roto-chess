/**
 * Rulings — every genuine rulebook ambiguity, encoded as ONE named value or
 * predicate so that Andrew's ratification (or reversal) of any ruling in
 * docs/RULINGS.md is a one-line change here and nowhere else.
 *
 * Do not inline any of these decisions elsewhere in the engine.
 */

/**
 * R1 — During the opening double-move, must submove 1 independently leave the
 * mover's king out of check (true), or only the completed turn (false)?
 * V1 default: true (§1.3 — standard chess never allows a moment in check).
 */
export const OPENING_SUBMOVE_MUST_AVOID_SELF_CHECK: boolean = true;

/**
 * R2 — If a player has legal single moves but no legal PAIR during the
 * opening, is that "no legal turn" (true → §7.3/§8.4 evaluation applies)?
 * V1 default: true. STRUCTURAL: this default is the shape of
 * legalTurns/hasAnyLegalTurn (turns are pairs; no pair = no turn). A
 * reversal (single-move fallback turns) would change those two functions
 * plus applyTurn's expected-count — not a one-line flip; recorded here so
 * the decision stays visible.
 */
export const OPENING_NO_PAIR_IS_NO_LEGAL_TURN: boolean = true;

/**
 * R3 — Queenside castling as an opening submove straddles the meridian;
 * which side does it count toward? V1 default: the King's origin square.
 */
export const CASTLE_OPENING_SIDE_ANCHOR: "king" | "queen" = "king";

/**
 * R4a — Does Avenger eligibility expire after a time window? V1 default:
 * no window — eligibility persists while both §6.4 conditions hold.
 * STRUCTURAL: the no-window default is the absence of a ply check in
 * avengerEligible (legal.ts); a window would add a capturedAtPly record to
 * the avenger memory. Recorded here so the decision stays visible.
 */
export const AVENGER_HAS_TIME_WINDOW: boolean = false;

/**
 * R4b — Must the avenging move itself be a capture? V1 default: no —
 * §6.4's two written conditions are the entire test.
 */
export const AVENGER_MOVE_MUST_CAPTURE: boolean = false;

/**
 * R5 — En passant window: the target expires when the immediately-following
 * player's turn completes; during the opening it is available to either
 * submove of that turn. Encoded in epWindowIsOpen (legal.ts) using this flag.
 */
export const EP_EXPIRES_AFTER_NEXT_PLAYERS_TURN: boolean = true;

/**
 * R6 — Kingside castling: do the knight (file C) and bishop (file B) need to
 * have MOVED away (true, §8.2.3 read literally), or do empty squares suffice
 * even if they were captured in place (false)?
 * V1 default: true.
 */
export const KINGSIDE_CASTLE_REQUIRES_PIECES_MOVED: boolean = true;

/**
 * R11 — May the SAME piece make both submoves of an opening turn (crossing
 * sides with its first submove, then moving again from the other side)?
 * V1 default: yes — §4.2 constrains the SIDES of the two moves (by origin,
 * R8), not which pieces make them.
 */
export const OPENING_MAY_MOVE_SAME_PIECE_TWICE: boolean = true;

/**
 * R12 — Kings are NEVER capturable. §7.2+§7.3 make a king-en-prise position
 * reachable on a third player's turn; §1.2 ends games by checkmate alone.
 * Structural guard: isCapturable in legal.ts. A reversal (king capture =
 * instant win) would be a different game.
 */
export const KINGS_ARE_NEVER_CAPTURABLE: boolean = true;

/**
 * R15 / open value — fifty-move counter: increment for a double-move opening
 * turn (§8.6 defines a "move" as one player's turn; V1 counts an opening
 * turn as 1). Note: evaporation does NOT reset the clock — §8.6 names only
 * pawn moves and captures, read literally.
 */
export const FIFTY_MOVE_INCREMENT_PER_OPENING_TURN = 1;
