/**
 * Layer 2 — Roto-PGN: the interchange/export format (never the storage
 * format). Canonical long form per Rulebook §3 + the Roto-PGN spec (TDD §3):
 *
 *   token   = PIECE FROM SEP TO SUFFIXES
 *   PIECE   = K Q R B N P        (P required in canonical form)
 *   FROM/TO = rank-first coordinates, e.g. 32D, 1A   (§2.2; the spec's §3.4
 *             examples are file-first — coordinate ORDER is awaiting the
 *             inventor's ruling. Emission is isolated behind
 *             formatSquareToken and the parser accepts BOTH orders, so the
 *             ruling lands as a one-line change.)
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
 *   Opening turns (§4.2): two moves joined by " & " — one turn, one record.
 *
 * Movetext is grouped by ROUND (TDD §3.9): each round is numbered and holds
 * the four turns labeled P1:–P4: in clockwise order:
 *
 *   1. P1: P2D-4D & P31D-29D  P2: ...  P3: ...  P4: ...
 *
 * Headers are PGN-style [Key "Value"] per TDD §3.8: Event, Date, Player1–4,
 * Team13, Team24, Result (13 | 24 | Draw | *), ResultRound, Termination,
 * Variant. Extra tags (Site, EngineVersion) follow the spec set.
 *
 * Parsing is REPLAY-BASED: each token is resolved against the legal moves of
 * the reconstructed position, so a parsed game is a validated game by
 * construction. The parser is deliberately LENIENT about surface variation:
 * P1:–P4: labels are optional, "&" spacing is flexible, both square-token
 * orders are accepted, and the pre-spec header dialect this engine used to
 * emit (North/East/South/West players, Result NS/EW/draw, ResultReason) is
 * mapped onto the spec fields — old exports and DB movetext still load.
 * Per Andrew's rule, spec examples in docs must be engine-generated — this
 * module is the generator.
 */

import {
  formatSquare,
  parseSquare,
  teamOf,
  type Seat,
  type Square,
} from "./geometry.js";
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
// Square tokens — the ONE place notation coordinate order is decided
// ---------------------------------------------------------------------------

/**
 * Emit a square token. Rank-first ("32D") pending the inventor's ruling on
 * §3.3-prose vs §3.4-examples; to flip to file-first ("D32"), change ONLY
 * this function's return expression.
 */
export function formatSquareToken(square: Square): string {
  return formatSquare(square);
}

/**
 * Parse a square token in EITHER order — they never collide: rank-first
 * starts with a digit, file-first starts with a file letter A–D.
 */
export function parseSquareToken(text: string): Square {
  const fileFirst = text.trim().match(/^([A-Da-d])([1-9][0-9]?)$/u);
  if (fileFirst) return parseSquare(`${fileFirst[2]}${fileFirst[1]}`);
  return parseSquare(text);
}

/** Square-token sub-pattern for move-token regexes (both orders). */
const SQ = "(?:[0-9]{1,2}[A-Da-d]|[A-Da-d][0-9]{1,2})";

// ---------------------------------------------------------------------------
// Serialization: Move → token
// ---------------------------------------------------------------------------

function pieceLetterAt(state: BoardState, sq: number): PieceKind {
  const piece = state.board[sq];
  if (!piece) throw new Error(`No piece at ${formatSquare(sq)} to notate`);
  return piece.kind;
}

/** Canonical suffix marks in canonical order (no check marks; turn-level). */
function suffixesOf(move: Move): string {
  let s = "";
  if (move.promotion) s += `=${move.promotion}`;
  if (move.enPassant) s += "e.p.";
  // §6.2 + §6.3: a capturing crosser earns its halo AND then evaporates —
  // the record shows both marks, in that order.
  if (move.earnsHalo) s += "*";
  if (move.evaporates) s += "†";
  if (move.avenger) s += "^";
  return s;
}

/** One submove → canonical token body (no check marks; those are turn-level). */
export function moveToToken(state: BoardState, move: Move): string {
  let body: string;
  if (move.castle === "kingside") body = "O-O";
  else if (move.castle === "queenside") body = "O-O-O";
  else {
    const piece = pieceLetterAt(state, move.from);
    const sep = move.captures !== undefined ? "x" : "-";
    body = `${piece}${formatSquareToken(move.from)}${sep}${formatSquareToken(move.to)}`;
  }
  return body + suffixesOf(move);
}

/**
 * One submove → abbreviated DISPLAY form (TDD §3.1) — a presentation
 * convenience generated from canonical + board state, never stored or parsed:
 *   - pawns never carry the P;
 *   - the from-square is dropped when exactly one same-type piece of the
 *     mover can legally reach the destination (judged against the actual
 *     legal-move set, so pins and rules count);
 *   - when the from-square is retained (ambiguity), the piece letter drops —
 *     the from-square already names the piece; when the from-square is
 *     dropped, the letter is what identifies the piece, so it stays;
 *   - a quiet move with the from-square dropped needs no "-" separator
 *     (`N30B`, pawn `3B`); captures always keep the x (`Nx30B`, pawn `x3C`);
 *   - all suffix annotations are kept.
 *
 * `candidates` is the legal-move set the abbreviation is judged against —
 * defaults to legalMoves(state); pass legalSecondSubmoves(...) when
 * displaying the second submove of an opening turn (with the mid-state).
 */
export function moveToDisplay(
  state: BoardState,
  move: Move,
  candidates: readonly Move[] = legalMoves(state),
): string {
  if (move.castle === "kingside") return `O-O${suffixesOf(move)}`;
  if (move.castle === "queenside") return `O-O-O${suffixesOf(move)}`;
  const kind = pieceLetterAt(state, move.from);
  const to = formatSquareToken(move.to);
  const isCapture = move.captures !== undefined;
  // Distinct origins of same-type pieces that can legally reach `move.to`.
  const sources = new Set(
    candidates
      .filter(
        (m) =>
          !m.castle &&
          m.to === move.to &&
          state.board[m.from]?.kind === kind,
      )
      .map((m) => m.from),
  );
  let body: string;
  if (sources.size <= 1) {
    if (kind === "P") body = isCapture ? `x${to}` : to;
    else body = isCapture ? `${kind}x${to}` : `${kind}${to}`;
  } else {
    body = `${formatSquareToken(move.from)}${isCapture ? "x" : "-"}${to}`;
  }
  return body + suffixesOf(move);
}

/**
 * A full turn → canonical token, applying it to compute check/mate marks.
 * Returns the token and the post-turn state. Opening submoves join with an
 * unspaced "&" in the TOKEN (one whitespace-free unit — the DB storage
 * form); serializeGame spaces it per the spec's movetext (" & ").
 */
export function turnToToken(
  state: BoardState,
  turn: Turn,
): { token: string; after: BoardState } {
  let token: string;
  if (turn.submoves.length === 2) {
    const first = turn.submoves[0];
    const mid = applySubmove(state, first);
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

/**
 * A full turn → display form (for move lists / UI), alongside the canonical
 * token (for tooltips and storage) and the post-turn state. Check/mate marks
 * are turn-level and appear on both forms.
 */
export function turnToDisplay(
  state: BoardState,
  turn: Turn,
): { display: string; canonical: string; after: BoardState } {
  const { token: canonical, after } = turnToToken(state, turn);
  const marks = canonical.match(/[+#]+$/u)?.[0] ?? "";
  let display: string;
  if (turn.submoves.length === 2) {
    const first = turn.submoves[0];
    const mid = applySubmove(state, first);
    display = `${moveToDisplay(state, first)} & ${moveToDisplay(
      mid,
      turn.submoves[1],
      legalSecondSubmoves(state, first),
    )}`;
  } else {
    display = moveToDisplay(state, turn.submoves[0]);
  }
  return { display: display + marks, canonical, after };
}

// ---------------------------------------------------------------------------
// Headers & full-game serialization
// ---------------------------------------------------------------------------

export interface GameHeaders {
  event?: string;
  site?: string;
  date?: string; // YYYY.MM.DD
  player1?: string;
  player2?: string;
  player3?: string;
  player4?: string;
  team13?: string;
  team24?: string;
  /** TDD §3.8: 13 = seats 1&3 win, 24 = seats 2&4 win, Draw, * = unfinished. */
  result?: "13" | "24" | "Draw" | "*";
  /** Round in which the game ended (1-based). */
  resultRound?: number;
  /** How the game ended — e.g. "Checkmate", "Stalemate", "Resignation". */
  termination?: string;
  engineVersion?: string;
  [key: string]: string | number | undefined;
}

const SEAT_HEADER: Record<Seat, "player1" | "player2" | "player3" | "player4"> =
  {
    1: "player1",
    2: "player2",
    3: "player3",
    4: "player4",
  };

export interface SerializedGameInput {
  headers?: GameHeaders;
  turns: readonly Turn[];
}

/**
 * Serialize headers + turns into a .rpgn document (TDD §3.8–3.9). Validates
 * by replay. Spec-required tags always appear (Event defaults to
 * "Casual game", Team13/Team24 to "Players 1 & 3"/"Players 2 & 4",
 * Result to "*"); tags whose values are unknown (Date, Player1–4,
 * ResultRound, Termination) are omitted rather than invented.
 */
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
  // Spec tag set, in spec order (TDD §3.8) …
  put("Event", headers.event ?? "Casual game");
  put("Date", headers.date);
  put("Player1", headers.player1);
  put("Player2", headers.player2);
  put("Player3", headers.player3);
  put("Player4", headers.player4);
  put("Team13", headers.team13 ?? "Players 1 & 3");
  put("Team24", headers.team24 ?? "Players 2 & 4");
  put("Result", headers.result ?? "*");
  put("ResultRound", headers.resultRound);
  put("Termination", headers.termination);
  put("Variant", "Roto Chess v3.1");
  // … then extra tags this engine records.
  put("Site", headers.site);
  put("EngineVersion", headers.engineVersion);
  lines.push("");

  // Movetext (TDD §3.9): rounds numbered, four turns per round labeled
  // P1:–P4:, opening submoves joined by a spaced " & ".
  let state = initialState();
  const parts: string[] = [];
  input.turns.forEach((turn, i) => {
    if (i % 4 === 0) parts.push(`${Math.floor(i / 4) + 1}.`);
    const seat = state.activeSeat;
    const { token, after } = turnToToken(state, turn);
    parts.push(`P${seat}: ${token.replace(/&/u, " & ")}`);
    state = after;
  });
  if (headers.result && headers.result !== "*") parts.push(headers.result);

  // Wrap movetext at ~80 columns (labels stay glued to their turns).
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

/** A single problem found while validating a Roto-PGN document. */
export interface GameIssue {
  /**
   * parse            — malformed token/header, or a token that is ambiguous
   *                    against the legal moves (corrupt record);
   * illegal-move     — a syntactically valid move the rules reject at its
   *                    position (TDD §10.3: translation error OR engine bug);
   * result-mismatch  — the replay contradicts the Result/ResultRound headers.
   */
  kind: "parse" | "illegal-move" | "result-mismatch";
  message: string;
  /** 1-based turn number of the offending token, when known. */
  ply?: number;
  /** 1-based round number, when known. */
  round?: number;
  /** Seat to move at the failure point, when known. */
  seat?: Seat;
  /** The offending movetext token, when known. */
  token?: string;
  /** Canonical tokens of the legal moves available at the failure point. */
  legalAlternatives?: string[];
}

export interface GameValidation {
  headers: GameHeaders;
  /** Turns successfully replayed (all of them when `issues` is empty). */
  turns: Turn[];
  /** The state reached — final on success, the failure position otherwise. */
  finalState: BoardState;
  issues: GameIssue[];
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
  const m = text.match(
    new RegExp(`^([KQRBNP])(${SQ})([-x])(${SQ})$`, "u"),
  );
  if (!m) throw new Error(`Unparseable move token: "${raw}"`);
  flags.piece = m[1] as string;
  flags.from = parseSquareToken(m[2] as string);
  flags.to = parseSquareToken(m[4] as string);
  flags.captures = m[3] === "x";
  return flags;
}

/** resolveToken failure, carrying what the archive report needs. */
class TokenResolveError extends Error {
  constructor(
    message: string,
    readonly reason: "syntax" | "no-match" | "ambiguous",
    readonly candidates: readonly Move[],
    readonly at: BoardState,
  ) {
    super(message);
  }
}

function resolveToken(
  state: BoardState,
  candidates: Move[],
  raw: string,
): Move {
  let flags: TokenFlags;
  try {
    flags = parseMoveToken(raw);
  } catch (e) {
    throw new TokenResolveError(
      e instanceof Error ? e.message : String(e),
      "syntax",
      candidates,
      state,
    );
  }
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
  if (matches.length === 0) {
    throw new TokenResolveError(
      `Token "${raw}" matches no legal move at this position`,
      "no-match",
      candidates,
      state,
    );
  }
  if (matches.length > 1) {
    throw new TokenResolveError(
      `Token "${raw}" matched ${matches.length} legal moves — corrupt or ambiguous record`,
      "ambiguous",
      candidates,
      state,
    );
  }
  return matches[0] as Move;
}

/** Canonical header keys — case-folded parse keys round-trip to the exact
 * camelCase fields serializeGame reads. Legacy pre-spec keys are aliased. */
const KEY_MAP: Record<string, string> = {
  event: "event", site: "site", date: "date", variant: "variant",
  player1: "player1", player2: "player2",
  player3: "player3", player4: "player4",
  // Legacy compass-named players (pre-spec dialect of this engine):
  north: "player1", east: "player2", south: "player3", west: "player4",
  team13: "team13", team24: "team24",
  result: "result", resultround: "resultRound",
  termination: "termination",
  // Legacy name for Termination:
  resultreason: "termination",
  engineversion: "engineVersion",
};

/** Spec Result values plus the legacy NS/EW/draw dialect, normalized. */
const RESULT_ALIASES: Record<string, NonNullable<GameHeaders["result"]>> = {
  "13": "13", "24": "24", Draw: "Draw", "*": "*",
  NS: "13", EW: "24", draw: "Draw",
};

/** Game-result tokens allowed to trail the movetext (spec + legacy). */
const RESULT_TOKEN = /^(?:13|24|Draw|draw|NS|EW|\*)$/u;

function readDocument(text: string): {
  headers: GameHeaders;
  tokens: string[];
  issues: GameIssue[];
} {
  const headers: GameHeaders = {};
  const issues: GameIssue[] = [];
  const movetextLines: string[] = [];
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    const h = line.match(/^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]$/u);
    if (h) {
      const rawKey = h[1] ?? "";
      const key = KEY_MAP[rawKey.toLowerCase()] ?? rawKey;
      const value = (h[2] as string)
        .replace(/\\"/gu, '"')
        .replace(/\\\\/gu, "\\");
      if (key === "resultRound") {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1) {
          issues.push({
            kind: "parse",
            message: `Invalid ResultRound header: "${value}"`,
          });
        } else {
          headers.resultRound = n;
        }
      } else if (key === "result") {
        const mapped = RESULT_ALIASES[value];
        if (!mapped) {
          issues.push({
            kind: "parse",
            message: `Invalid Result header: "${value}"`,
          });
        } else {
          headers.result = mapped;
        }
      } else {
        headers[key] = value;
      }
    } else {
      movetextLines.push(line);
    }
  }

  const tokens = movetextLines
    .join(" ")
    // "&" spacing is flexible: "A & B", "A &B", "A&B" all read as one turn.
    .replace(/\s*&\s*/gu, "&")
    .split(/\s+/u)
    // P1:–P4: labels are optional and may be glued to their turn.
    .map((t) => t.replace(/^P[1-4]:/u, ""))
    .filter(
      (t) =>
        t.length > 0 &&
        !/^\d+\.$/u.test(t) &&
        !RESULT_TOKEN.test(t),
    );
  return { headers, tokens, issues };
}

/** Distinct canonical tokens for a legal-move set (failure reports). */
function canonicalAlternatives(
  state: BoardState,
  candidates: readonly Move[],
): string[] {
  return [...new Set(candidates.map((m) => moveToToken(state, m)))];
}

/**
 * Parse AND replay a .rpgn document, collecting structured issues instead of
 * throwing — the archive-validation entry point (TDD §10.3). Replay stops at
 * the first parse/illegal-move issue (nothing after it can be trusted);
 * result-mismatch checks run only on a fully replayed game. A Result header
 * the replay cannot derive (resignation, agreement) is NOT a mismatch — only
 * a replayed terminal status that CONTRADICTS the headers is.
 */
export function validateGameText(text: string): GameValidation {
  const { headers, tokens, issues } = readDocument(text);
  let state = initialState();
  const turns: Turn[] = [];

  for (const token of tokens) {
    const ply = turns.length + 1;
    const round = Math.floor(turns.length / 4) + 1;
    const seat = state.activeSeat;
    try {
      let turn: Turn;
      if (inOpening(state)) {
        const parts = token.split("&");
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
          issues.push({
            kind: "parse", ply, round, seat, token,
            message:
              `Opening turn must be exactly two "&"-joined moves: "${token}"`,
          });
          break;
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
        turn = { submoves: [resolveToken(state, legalMoves(state), token)] };
      }
      const applied = applyTurn(state, turn);
      if (!applied.ok) {
        issues.push({
          kind: "illegal-move", ply, round, seat, token,
          message: `Replay rejected "${token}": ${applied.error}`,
          legalAlternatives: canonicalAlternatives(state, legalMoves(state)),
        });
        break;
      }
      turns.push(turn);
      state = applied.state;
    } catch (e) {
      if (e instanceof TokenResolveError) {
        issues.push({
          kind: e.reason === "no-match" ? "illegal-move" : "parse",
          ply, round, seat, token,
          message: e.message,
          ...(e.reason === "no-match"
            ? {
                legalAlternatives: canonicalAlternatives(e.at, e.candidates),
              }
            : {}),
        });
      } else {
        issues.push({
          kind: "parse", ply, round, seat, token,
          message: e instanceof Error ? e.message : String(e),
        });
      }
      break;
    }
  }

  if (issues.length === 0) {
    const status = evaluateStatus(state);
    const computed: NonNullable<GameHeaders["result"]> =
      status.kind === "checkmate"
        ? status.winningTeam === 1
          ? "13"
          : "24"
        : status.kind === "stalemate"
          ? "Draw"
          : "*";
    if (computed !== "*") {
      if (headers.result !== undefined && headers.result !== computed) {
        issues.push({
          kind: "result-mismatch",
          message:
            `Header Result "${headers.result}" but the replay ends in ` +
            `${status.kind} ("${computed}")`,
        });
      }
      const endRound = Math.ceil(state.ply / 4);
      if (
        headers.resultRound !== undefined &&
        headers.resultRound !== endRound
      ) {
        issues.push({
          kind: "result-mismatch",
          message:
            `Header ResultRound ${headers.resultRound} but the game ` +
            `ended in round ${endRound}`,
        });
      }
    }
  }

  return { headers, turns, finalState: state, issues };
}

/**
 * Parse a .rpgn document, validating every turn by replay. Throws on the
 * first parse or illegal-move issue. Result headers are carried through, not
 * checked here (resignations end games the replay cannot derive); use
 * validateGameText for full archive-grade validation.
 */
export function parseGame(text: string): ParsedGame {
  const v = validateGameText(text);
  const fatal = v.issues.find((i) => i.kind !== "result-mismatch");
  if (fatal) {
    throw new Error(
      fatal.ply !== undefined
        ? `Replay failed at turn ${fatal.ply} ("${fatal.token ?? ""}"): ${fatal.message}`
        : fatal.message,
    );
  }
  return { headers: v.headers, turns: v.turns, finalState: v.finalState };
}

export { SEAT_HEADER };
