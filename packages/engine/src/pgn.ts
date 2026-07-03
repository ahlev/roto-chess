/**
 * Layer 2 — Roto-PGN: the interchange/export format (never the storage
 * format). Canonical long form per Rulebook §3 + the Roto-PGN spec:
 *
 *   token   = PIECE FROM SEP TO SUFFIXES
 *   PIECE   = K Q R B N P        (P required in canonical form)
 *   FROM/TO = rank-first coordinates, e.g. 32D, 1A   (§2.2; see ruling R10 —
 *             §3.3's file-first examples are a pre-v3.0 leftover)
 *   SEP     = "-" quiet | "x" capture
 *   SUFFIXES, in canonical order:
 *     =Q =R =B =N   promotion (§8.3; the promoted piece's halo is implicit)
 *     e.p.          en passant capture (§8.1)
 *     *             halo earned (§6.2)
 *     †             evaporation (§6.3 — the move completed, then the piece went)
 *     ^             Avenger exemption invoked (§6.4)
 *     +             at least one opposing player is left in check
 *     #             this turn finalized checkmate (§7.3 — the mate is
 *                   diagnosed when the victim's turn arrives with no escape,
 *                   so # attaches to the turn that CLOSED the door, which is
 *                   not necessarily the turn that delivered the check)
 *   Castling: O-O (kingside, §8.2.1 radial) | O-O-O (queenside K↔Q swap),
 *             with the same suffix rules.
 *   Opening turns (§4.2): two tokens joined by "&" — one turn, one record.
 *
 * Movetext is grouped by ROUND: `1. <P1turn> <P2turn> <P3turn> <P4turn> 2. …`
 * Headers are PGN-style [Key "Value"]. Seats are compass names.
 *
 * Parsing is REPLAY-BASED: each token is resolved against the legal moves of
 * the reconstructed position, so a parsed game is a validated game by
 * construction. Per Andrew's rule, spec examples in docs must be
 * engine-generated — this module is the generator.
 */

import { formatSquare, parseSquare, teamOf, type Seat } from "./geometry.js";
import {
  inOpening,
  initialState,
  type BoardState,
  type PieceKind,
} from "./state.js";
import type { Move, PromotionKind, Turn } from "./moves.js";
import {
  applySubmove,
  applyTurn,
  isInCheck,
  legalMoves,
  legalSecondSubmoves,
} from "./legal.js";
import { evaluateStatus } from "./status.js";
import { SEATS } from "./geometry.js";

// ---------------------------------------------------------------------------
// Serialization: Move → token
// ---------------------------------------------------------------------------

function pieceLetterAt(state: BoardState, sq: number): PieceKind {
  const piece = state.board[sq];
  if (!piece) throw new Error(`No piece at ${formatSquare(sq)} to notate`);
  return piece.kind;
}

/** One submove → canonical token body (no check marks; those are turn-level). */
export function moveToToken(state: BoardState, move: Move): string {
  let body: string;
  if (move.castle === "kingside") body = "O-O";
  else if (move.castle === "queenside") body = "O-O-O";
  else {
    const piece = pieceLetterAt(state, move.from);
    const sep = move.captures !== undefined ? "x" : "-";
    body = `${piece}${formatSquare(move.from)}${sep}${formatSquare(move.to)}`;
  }
  if (move.promotion) body += `=${move.promotion}`;
  if (move.enPassant) body += "e.p.";
  // §6.2 + §6.3: a capturing crosser earns its halo AND then evaporates —
  // the record shows both marks, in that order.
  if (move.earnsHalo) body += "*";
  if (move.evaporates) body += "†";
  if (move.avenger) body += "^";
  return body;
}

/**
 * A full turn → canonical token, applying it to compute check/mate marks.
 * Returns the token and the post-turn state.
 */
export function turnToToken(
  state: BoardState,
  turn: Turn,
): { token: string; after: BoardState } {
  let token: string;
  if (turn.submoves.length === 2) {
    const first = turn.submoves[0];
    const mid = applyTurnDry(state, first);
    token = `${moveToToken(state, first)}&${moveToToken(mid, turn.submoves[1])}`;
  } else {
    token = moveToToken(state, turn.submoves[0]);
  }
  const result = applyTurn(state, turn);
  if (!result.ok) {
    throw new Error(`turnToToken: illegal turn (${result.error})`);
  }
  const after = result.state;
  const status = evaluateStatus(after);
  if (status.kind === "checkmate") {
    token += "#";
  } else {
    const mover = state.activeSeat;
    const enemiesInCheck = SEATS.filter(
      (s) => teamOf(s) !== teamOf(mover) && isInCheck(after, s),
    );
    if (enemiesInCheck.length > 0) token += "+";
  }
  return { token, after };
}

/** Apply only the first submove (for notating the second against the mid-state). */
function applyTurnDry(state: BoardState, first: Move): BoardState {
  return applySubmove(state, first);
}

// ---------------------------------------------------------------------------
// Headers & full-game serialization
// ---------------------------------------------------------------------------

export interface GameHeaders {
  event?: string;
  site?: string;
  date?: string; // YYYY.MM.DD
  north?: string;
  east?: string;
  south?: string;
  west?: string;
  result?: "NS" | "EW" | "draw" | "*";
  resultReason?: string;
  /** Round in which the game ended (1-based). */
  resultRound?: number;
  engineVersion?: string;
  [key: string]: string | number | undefined;
}

const SEAT_HEADER: Record<Seat, "north" | "east" | "south" | "west"> = {
  1: "north",
  2: "east",
  3: "south",
  4: "west",
};

export interface SerializedGameInput {
  headers?: GameHeaders;
  turns: readonly Turn[];
}

/** Serialize headers + turns into a .rpgn document. Validates by replay. */
export function serializeGame(input: SerializedGameInput): string {
  const lines: string[] = [];
  const headers = input.headers ?? {};
  const put = (key: string, value: string | number | undefined) => {
    if (value === undefined) return;
    // PGN-convention escaping; newlines would corrupt the document shape.
    const text = String(value).replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
    if (/[\r\n]/u.test(text)) {
      throw new Error(`Header ${key} must not contain line breaks`);
    }
    lines.push(`[${key} "${text}"]`);
  };
  put("Event", headers.event);
  put("Site", headers.site);
  put("Date", headers.date);
  put("Variant", "Roto Chess v3.1");
  put("North", headers.north);
  put("East", headers.east);
  put("South", headers.south);
  put("West", headers.west);
  put("Result", headers.result ?? "*");
  put("ResultReason", headers.resultReason);
  put("ResultRound", headers.resultRound);
  put("EngineVersion", headers.engineVersion);
  lines.push("");

  let state = initialState();
  const parts: string[] = [];
  input.turns.forEach((turn, i) => {
    if (i % 4 === 0) parts.push(`${Math.floor(i / 4) + 1}.`);
    const { token, after } = turnToToken(state, turn);
    parts.push(token);
    state = after;
  });
  if (headers.result && headers.result !== "*") parts.push(headers.result);

  // Wrap movetext at ~80 columns.
  let line = "";
  for (const part of parts) {
    if (line.length + part.length + 1 > 80) {
      lines.push(line);
      line = part;
    } else {
      line = line ? `${line} ${part}` : part;
    }
  }
  if (line) lines.push(line);
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Parsing: replay-based
// ---------------------------------------------------------------------------

export interface ParsedGame {
  headers: GameHeaders;
  turns: Turn[];
  finalState: BoardState;
}

interface TokenFlags {
  castle: "kingside" | "queenside" | null;
  piece: string | null;
  from: number | null;
  to: number | null;
  captures: boolean;
  promotion: PromotionKind | null;
  enPassant: boolean;
  halo: boolean;
  evaporates: boolean;
  avenger: boolean;
}

function parseMoveToken(raw: string): TokenFlags {
  let text = raw;
  const flags: TokenFlags = {
    castle: null,
    piece: null,
    from: null,
    to: null,
    captures: false,
    promotion: null,
    enPassant: false,
    halo: false,
    evaporates: false,
    avenger: false,
  };
  // Strip check marks (redundant under replay) and suffixes right-to-left.
  text = text.replace(/[+#]+$/u, "");
  for (;;) {
    if (text.endsWith("^")) {
      flags.avenger = true;
      text = text.slice(0, -1);
    } else if (text.endsWith("†")) {
      flags.evaporates = true;
      text = text.slice(0, -1);
    } else if (text.endsWith("*")) {
      flags.halo = true;
      text = text.slice(0, -1);
    } else if (text.endsWith("e.p.")) {
      flags.enPassant = true;
      text = text.slice(0, -4);
    } else if (/=[QRBN]$/.test(text)) {
      flags.promotion = text.slice(-1) as PromotionKind;
      text = text.slice(0, -2);
    } else {
      break;
    }
  }
  if (text === "O-O" || text === "O-O-O") {
    if (
      flags.promotion || flags.enPassant || flags.halo ||
      flags.evaporates || flags.avenger
    ) {
      throw new Error(`Castle token cannot carry effect suffixes: "${raw}"`);
    }
    flags.castle = text === "O-O" ? "kingside" : "queenside";
    return flags;
  }
  const m = text.match(/^([KQRBNP])([0-9]{1,2}[A-D])([-x])([0-9]{1,2}[A-D])$/u);
  if (!m) throw new Error(`Unparseable move token: "${raw}"`);
  flags.piece = m[1] as string;
  flags.from = parseSquare(m[2] as string);
  flags.to = parseSquare(m[4] as string);
  flags.captures = m[3] === "x";
  return flags;
}

function resolveToken(
  state: BoardState,
  candidates: Move[],
  raw: string,
): Move {
  const flags = parseMoveToken(raw);
  const matches = candidates.filter((mv) => {
    if (flags.castle) return mv.castle === flags.castle;
    if (mv.castle) return false;
    if (mv.from !== flags.from || mv.to !== flags.to) return false;
    if ((mv.captures !== undefined) !== flags.captures) return false;
    if ((mv.promotion ?? null) !== flags.promotion) return false;
    if ((mv.enPassant ?? false) !== flags.enPassant) return false;
    if ((mv.earnsHalo ?? false) !== flags.halo) return false;
    if ((mv.evaporates ?? false) !== flags.evaporates) return false;
    if ((mv.avenger ?? false) !== flags.avenger) return false;
    const piece = state.board[mv.from];
    return piece?.kind === flags.piece;
  });
  if (matches.length !== 1) {
    throw new Error(
      `Token "${raw}" matched ${matches.length} legal moves at ply — corrupt or ambiguous record`,
    );
  }
  return matches[0] as Move;
}

/** Parse a .rpgn document, validating every turn by replay. */
export function parseGame(text: string): ParsedGame {
  const headers: GameHeaders = {};
  const movetextLines: string[] = [];
  // Canonical header keys — case-folded parse keys must round-trip to the
  // exact camelCase fields serializeGame reads.
  const KEY_MAP: Record<string, string> = {
    event: "event", site: "site", date: "date", variant: "variant",
    north: "north", east: "east", south: "south", west: "west",
    result: "result", resultreason: "resultReason",
    resultround: "resultRound", engineversion: "engineVersion",
  };
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    const h = line.match(/^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]$/u);
    if (h) {
      const key = KEY_MAP[(h[1] as string).toLowerCase()] ?? (h[1]);
      const value = (h[2] as string)
        .replace(/\\"/gu, '"')
        .replace(/\\\\/gu, "\\");
      if (key === "resultRound") {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1) {
          throw new Error(`Invalid ResultRound header: "${value}"`);
        }
        headers.resultRound = n;
      } else if (key === "result") {
        if (!["NS", "EW", "draw", "*"].includes(value)) {
          throw new Error(`Invalid Result header: "${value}"`);
        }
        headers.result = value as NonNullable<GameHeaders["result"]>;
      } else {
        headers[key] = value;
      }
    } else {
      movetextLines.push(line);
    }
  }

  const tokens = movetextLines
    .join(" ")
    .split(/\s+/u)
    .filter(
      (t) =>
        t.length > 0 &&
        !/^\d+\.$/u.test(t) &&
        t !== "NS" &&
        t !== "EW" &&
        t !== "draw" &&
        t !== "*",
    );

  let state = initialState();
  const turns: Turn[] = [];
  for (const token of tokens) {
    let turn: Turn;
    if (inOpening(state)) {
      const parts = token.split("&");
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error(
          `Opening turn token must be exactly two "&"-joined moves: "${token}"`,
        );
      }
      const [a, b] = parts as [string, string];
      const first = resolveToken(state, legalMoves(state), a);
      const mid = applySubmove(state, first);
      const second = resolveToken(
        mid,
        legalSecondSubmoves(state, first),
        b,
      );
      turn = { submoves: [first, second] as const };
    } else {
      const move = resolveToken(state, legalMoves(state), token);
      turn = { submoves: [move] as const };
    }
    const applied = applyTurn(state, turn);
    if (!applied.ok) {
      throw new Error(`Replay failed at "${token}": ${applied.error}`);
    }
    turns.push(turn);
    state = applied.state;
  }

  return { headers, turns, finalState: state };
}

export { SEAT_HEADER };
