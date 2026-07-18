/**
 * Layer 3 — Legality: per-piece move generators, legalTurns, applyTurn.
 *
 * The engine's public API is turn-based: legalTurns(state) / applyTurn(state,
 * turn). Single submoves are generated internally and composed into turns
 * (two submoves, one per meridian side, during the opening — §4.2).
 *
 * Direction matters on a ring: the same destination reached clockwise vs
 * counterclockwise can differ in blocking, halo-earning (§6.2 reach-or-pass),
 * and own-meridian crossing (§6.3). Generators walk real paths and compute
 * every effect; effect-identical duplicates are pruned (shortest path kept).
 */

import {
  FILE_COUNT,
  RANK_COUNT,
  SEATS,
  type Rank,
  type Seat,
  type Square,
  backRanks,
  fileOf,
  isValidFile,
  meridianSide,
  nextSeat,
  pawnDirection,
  promotionRank,
  rankOf,
  seatSetup,
  spanCrossesOwnMeridian,
  squareOf,
  teamOf,
  wrapRank,
} from "./geometry.js";
import {
  type BoardState,
  type EpTarget,
  type Piece,
  STATE_SCHEMA_VERSION,
  inOpening,
  initialSeatOf,
  isPrimary,
} from "./state.js";
import {
  type Move,
  type MoveRef,
  type PromotionKind,
  type RotDir,
  type Turn,
  type TurnRef,
  moveMatchesRef,
  movesEffectIdentical,
} from "./moves.js";
import {
  CASTLE_OPENING_SIDE_ANCHOR,
  EP_EXPIRES_AFTER_NEXT_PLAYERS_TURN,
  FIFTY_MOVE_INCREMENT_PER_OPENING_TURN,
  KINGSIDE_CASTLE_REQUIRES_PIECES_MOVED,
  OPENING_MAY_MOVE_SAME_PIECE_TWICE,
  OPENING_SUBMOVE_MUST_AVOID_SELF_CHECK,
} from "./rulings.js";

const PROMOTION_KINDS: readonly PromotionKind[] = ["Q", "R", "B", "N"];

// ---------------------------------------------------------------------------
// Small board helpers
// ---------------------------------------------------------------------------

function pieceAt(state: BoardState, sq: Square): Piece | null {
  return state.board[sq] ?? null;
}

/** Partner pieces are friendly: they block, cannot be captured, never check (R9). */
function isEnemy(piece: Piece, seat: Seat): boolean {
  return teamOf(piece.seat) !== teamOf(seat);
}

/**
 * R12: kings are NEVER capturable. In four-player play a checked king can
 * legally sit attacked through other players' turns (§7.2 + §7.3), so
 * without this guard a third player could "capture" a king the rules say
 * is resolved only when its owner's turn arrives. Kings block like any
 * piece but are not capture targets; §1.2 games end by checkmate alone.
 */
function isCapturable(piece: Piece, seat: Seat): boolean {
  return isEnemy(piece, seat) && piece.kind !== "K";
}

/** The four back ranks of the two ENEMY seats (partner's never earn halos). */
function enemyBackRankSet(seat: Seat): Set<Rank> {
  const set = new Set<Rank>();
  for (const other of SEATS) {
    if (teamOf(other) !== teamOf(seat)) {
      for (const rank of backRanks(other)) set.add(rank);
    }
  }
  return set;
}

/** R5: an EP window is open only during the immediately-following turn. */
export function epWindowIsOpen(state: BoardState, target: EpTarget): boolean {
  if (!EP_EXPIRES_AFTER_NEXT_PLAYERS_TURN) return true; // alternate R5: window persists
  return state.ply === target.createdAtPly + 1;
}

// ---------------------------------------------------------------------------
// Halo / evaporation / Avenger effect computation (§6.2–6.4)
// ---------------------------------------------------------------------------

/**
 * Avenger eligibility (§6.4, ruled by Andrew 2026-07-18): the crossing move
 * must CAPTURE the enemy standing on an unmoved teammate's grave. All three:
 *   1. the avenger has never moved (still on its original start square);
 *   2. the move captures;
 *   3. the DESTINATION is the game-start square of an own-team piece that
 *      never moved and is gone — i.e., it was captured in place.
 * "Pieces in both the starting and ending positions have not moved."
 * Stateless: with the destination held by an enemy, startPieceMoved false
 * for it implies its game-start piece died on its home square. (Destination,
 * not the capture square: §6.4 speaks of the ending position; the en passant
 * split is moot — pawns are never primaries.)
 */
function avengerEligible(
  state: BoardState,
  piece: Piece,
  to: Square,
  captures: Square | undefined,
): boolean {
  if (piece.hasMoved || piece.promoted) return false;
  if (captures === undefined) return false;
  const fallenSeat = initialSeatOf(to);
  if (fallenSeat === null || teamOf(fallenSeat) !== teamOf(piece.seat)) {
    return false;
  }
  return !(state.startPieceMoved[to] ?? false);
}

interface EffectInput {
  state: BoardState;
  piece: Piece;
  from: Square;
  to: Square;
  path: readonly Square[];
  captures?: Square | undefined;
  /** Rank-span traversal for meridian crossing: total rank steps + direction. */
  rankSteps: number;
  rankDir: RotDir | 0;
  promotion?: PromotionKind | undefined;
}

/**
 * Compute halo/evaporation/avenger effects for a candidate move.
 * Ordering per §6.3: the move completes (including capture), halos earn at
 * conclusion (§6.2), and evaporation then removes a non-haloed primary that
 * crossed its own meridian — the just-earned halo does NOT save it.
 */
function computeEffects(input: EffectInput): {
  earnsHalo: boolean;
  evaporates: boolean;
  avenger: boolean;
} {
  const { state, piece, from, path, captures, rankSteps, rankDir } = input;
  const seat = piece.seat;

  // Halo (§6.2): primaries only; capture anywhere, or reach-or-pass an
  // opposing back rank (the PATH includes every traversed square, so a
  // slider passing through earns it; knights land on-or-past by geometry).
  let earnsHalo = false;
  if (isPrimary(piece.kind) && !piece.halo) {
    if (captures !== undefined) {
      earnsHalo = true;
    } else {
      const targets = enemyBackRankSet(seat);
      earnsHalo = path.some((sq) => targets.has(rankOf(sq)));
    }
  }

  // Own-meridian crossing (§6.3): rank-wise traversal only (radial moves
  // never cross; a meridian is an angular boundary).
  const crosses =
    rankDir !== 0 &&
    rankSteps > 0 &&
    spanCrossesOwnMeridian(seat, rankOf(from), rankSteps, rankDir);

  let evaporates = false;
  let avenger = false;
  if (crosses && isPrimary(piece.kind) && !piece.halo) {
    if (avengerEligible(state, piece, input.to, captures)) {
      avenger = true;
    } else {
      evaporates = true;
    }
  }

  return { earnsHalo, evaporates, avenger };
}

// ---------------------------------------------------------------------------
// Pseudo-legal generation (self-check filtering happens at turn level)
// ---------------------------------------------------------------------------

interface RayStep {
  dRank: -1 | 0 | 1;
  dFile: -1 | 0 | 1;
}

const ROOK_RAYS: readonly RayStep[] = [
  { dRank: 1, dFile: 0 },
  { dRank: -1, dFile: 0 },
  { dRank: 0, dFile: 1 },
  { dRank: 0, dFile: -1 },
];

const BISHOP_RAYS: readonly RayStep[] = [
  { dRank: 1, dFile: 1 },
  { dRank: 1, dFile: -1 },
  { dRank: -1, dFile: 1 },
  { dRank: -1, dFile: -1 },
];

const KNIGHT_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 2], [1, -2], [-1, 2], [-1, -2],
  [2, 1], [2, -1], [-2, 1], [-2, -1],
];

function makeMove(
  input: EffectInput,
  extra?: Partial<Move>,
): Move {
  const effects = computeEffects(input);
  const move: Move = {
    from: input.from,
    to: input.to,
    path: input.path,
    ...(input.captures !== undefined ? { captures: input.captures } : {}),
    ...(input.promotion !== undefined ? { promotion: input.promotion } : {}),
    ...(input.rankDir !== 0 ? { rotDir: input.rankDir } : {}),
    ...(effects.earnsHalo ? { earnsHalo: true } : {}),
    ...(effects.evaporates ? { evaporates: true } : {}),
    ...(effects.avenger ? { avenger: true } : {}),
    ...extra,
  };
  return move;
}

/**
 * Slide along straight rays (rook/queen/king-with-range-1). Circumferential
 * legs wrap and stop before revisiting the origin (no 32-step null move);
 * radial legs clamp at the rails.
 */
function generateSlides(
  state: BoardState,
  from: Square,
  piece: Piece,
  rays: readonly RayStep[],
  maxSteps: number,
  out: Move[],
): void {
  for (const ray of rays) {
    let rank = rankOf(from);
    let file = fileOf(from);
    const path: Square[] = [];
    for (let step = 1; step <= maxSteps; step++) {
      rank = wrapRank(rank + ray.dRank);
      file = file + ray.dFile;
      if (!isValidFile(file)) break;
      const sq = squareOf(rank, file);
      if (sq === from) break; // full circumnavigation — no null move
      const occupant = pieceAt(state, sq);
      path.push(sq);
      const rankSteps = ray.dRank === 0 ? 0 : step;
      const rankDir = ray.dRank;
      if (occupant) {
        if (isCapturable(occupant, piece.seat)) {
          out.push(
            makeMove({
              state, piece, from, to: sq, path: [...path],
              captures: sq, rankSteps, rankDir,
            }),
          );
        }
        break;
      }
      out.push(
        makeMove({
          state, piece, from, to: sq, path: [...path],
          rankSteps, rankDir,
        }),
      );
    }
  }
}

/**
 * Bishop banana curl (§5.4): walk the color chain; at most ONE bounce off a
 * rail per move, reflecting the radial component; the move ends at a rail
 * with no bounce left, at a blocker, or on a capture.
 */
function generateBishop(
  state: BoardState,
  from: Square,
  piece: Piece,
  out: Move[],
  // Attack testing must still "see" enemy kings (R12 removes them only as
  // CAPTURE targets); move generation uses the default.
  captureTest: (p: Piece, seat: Seat) => boolean = isCapturable,
): void {
  for (const ray of BISHOP_RAYS) {
    let rank = rankOf(from);
    let file = fileOf(from);
    let dFile = ray.dFile as number;
    let bounced = false;
    const path: Square[] = [];
    // Rank advances monotonically; a full revolution bounds the walk.
    for (let step = 1; step < RANK_COUNT; step++) {
      let nextFile = file + dFile;
      if (!isValidFile(nextFile)) {
        if (bounced) break; // second rail contact — the move is over
        bounced = true;
        dFile = -dFile;
        nextFile = file + dFile;
        if (!isValidFile(nextFile)) break; // degenerate (1-wide board); impossible here
      }
      rank = wrapRank(rank + ray.dRank);
      file = nextFile;
      const sq = squareOf(rank, file);
      if (sq === from) break; // curled all the way home — no null move
      const occupant = pieceAt(state, sq);
      path.push(sq);
      const rankDir = ray.dRank as RotDir;
      if (occupant) {
        if (captureTest(occupant, piece.seat)) {
          out.push(
            makeMove({
              state, piece, from, to: sq, path: [...path],
              captures: sq, rankSteps: step, rankDir,
            }),
          );
        }
        break;
      }
      out.push(
        makeMove({
          state, piece, from, to: sq, path: [...path],
          rankSteps: step, rankDir,
        }),
      );
      // A bishop ends its move when it REACHES a rail with no bounce left.
      if (bounced && (file === 0 || file === FILE_COUNT - 1)) break;
    }
  }
}

function generateKnight(
  state: BoardState,
  from: Square,
  piece: Piece,
  out: Move[],
): void {
  for (const [dRank, dFile] of KNIGHT_OFFSETS) {
    const file = fileOf(from) + dFile;
    if (!isValidFile(file)) continue; // no radial wrap; off-annulus is off the board
    const rank = wrapRank(rankOf(from) + dRank);
    const sq = squareOf(rank, file);
    const occupant = pieceAt(state, sq);
    if (occupant && !isCapturable(occupant, piece.seat)) continue;
    out.push(
      makeMove({
        state, piece, from, to: sq, path: [sq],
        captures: occupant ? sq : undefined,
        rankSteps: Math.abs(dRank),
        rankDir: dRank === 0 ? 0 : ((Math.sign(dRank) as RotDir)),
      }),
    );
  }
}

function generatePawn(
  state: BoardState,
  from: Square,
  piece: Piece,
  out: Move[],
): void {
  const seat = piece.seat;
  const dir = pawnDirection(seat, rankOf(piece.origin));
  const promoRank = promotionRank(seat, rankOf(piece.origin));
  const fromRank = rankOf(from);
  const file = fileOf(from);

  const pushMoves = (
    to: Square,
    path: Square[],
    captures: Square | undefined,
    rankSteps: number,
    isDoubleStep: boolean,
    enPassant: boolean,
  ) => {
    const promotes = rankOf(to) === promoRank;
    const kinds: readonly (PromotionKind | undefined)[] = promotes
      ? PROMOTION_KINDS
      : [undefined];
    for (const promotion of kinds) {
      out.push(
        makeMove(
          { state, piece, from, to, path, captures, rankSteps, rankDir: dir, promotion },
          {
            ...(enPassant ? { enPassant: true } : {}),
            ...(isDoubleStep ? {} : {}),
          },
        ),
      );
    }
  };

  // Forward one (§5.7)
  const one = squareOf(wrapRank(fromRank + dir), file);
  if (!pieceAt(state, one)) {
    pushMoves(one, [one], undefined, 1, false, false);
    // Forward two on the pawn's first move
    if (!piece.hasMoved) {
      const two = squareOf(wrapRank(fromRank + 2 * dir), file);
      if (!pieceAt(state, two)) {
        pushMoves(two, [one, two], undefined, 2, true, false);
      }
    }
  }

  // Diagonal captures: one forward along the file, one file inward/outward
  for (const dFile of [-1, 1]) {
    const capFile = file + dFile;
    if (!isValidFile(capFile)) continue;
    const capSq = squareOf(wrapRank(fromRank + dir), capFile);
    const occupant = pieceAt(state, capSq);
    if (occupant && isCapturable(occupant, seat)) {
      pushMoves(capSq, [capSq], capSq, 1, false, false);
      continue;
    }
    if (occupant) continue; // friendly occupant: no capture, and EP needs the square EMPTY
    // En passant (§8.1, R5): capture as if the double-stepped pawn had
    // advanced one; victim sits on its landing square.
    for (const target of state.epTargets) {
      if (!epWindowIsOpen(state, target)) continue;
      if (target.square !== capSq) continue;
      const victim = pieceAt(state, target.pawnSquare);
      if (!victim || !isEnemy(victim, seat)) continue;
      pushMoves(capSq, [capSq], target.pawnSquare, 1, false, true);
    }
  }
}

function generateKing(
  state: BoardState,
  from: Square,
  piece: Piece,
  out: Move[],
): void {
  generateSlides(state, from, piece, [...ROOK_RAYS, ...BISHOP_RAYS], 1, out);
  generateCastles(state, from, piece, out);
}

/**
 * Castling (§8.2). Generated as king moves carrying `castle`.
 * Attack checks live here (they are part of castling legality, §8.2.3) —
 * the only pseudo-legal generation that consults attacks directly.
 */
function generateCastles(
  state: BoardState,
  from: Square,
  piece: Piece,
  out: Move[],
): void {
  if (piece.hasMoved) return;
  const seat = piece.seat;
  const setup = seatSetup(seat);
  const kingHome = squareOf(setup.kingBack, 3);
  if (from !== kingHome) return;
  const enemy = enemyTeamOf(seat);
  if (isSquareAttacked(state, from, enemy)) return; // may not castle out of check

  // Queenside (§8.2.1): K and Q swap squares across the player's own
  // meridian; the rook does not move. Adjacent swap on file D.
  {
    const queenHome = squareOf(setup.queenBack, 3);
    const q = pieceAt(state, queenHome);
    if (q && q.kind === "Q" && q.seat === seat && !q.hasMoved) {
      // King lands on the queen's square; it must not be attacked (§8.2.3).
      // (Attack test must ignore the departing king/queen swap subtleties —
      // the swap is adjacent, so testing the destination in the current
      // position is exact except for the queen itself, which cannot attack
      // its own king anyway.)
      if (!isSquareAttacked(state, queenHome, enemy)) {
        out.push({
          from,
          to: queenHome,
          path: [queenHome],
          castle: "queenside",
          // K/Q are halo-exempt (§6.2) — crossing is free; no effects.
        });
      }
    }
  }

  // Kingside (§8.2.1): K slides radially D→A on its back rank; R slides
  // A→B. Files B and C must be empty AND (ruling R6) the knight and bishop
  // that started there must have MOVED away — captured in place does not
  // qualify. The king passes through C and B and lands on A: none may be
  // attacked.
  {
    const rank = setup.kingBack;
    const rookHome = squareOf(rank, 0);
    const bishopHome = squareOf(rank, 1);
    const knightHome = squareOf(rank, 2);
    const r = pieceAt(state, rookHome);
    if (
      r && r.kind === "R" && r.seat === seat && !r.hasMoved &&
      !pieceAt(state, bishopHome) && !pieceAt(state, knightHome) &&
      kingsideVacancyByMovement(state, bishopHome, knightHome) &&
      !isSquareAttacked(state, knightHome, enemy) &&
      !isSquareAttacked(state, bishopHome, enemy) &&
      !isSquareAttacked(state, rookHome, enemy)
    ) {
      out.push({
        from,
        to: rookHome,
        path: [knightHome, bishopHome, rookHome],
        castle: "kingside",
      });
    }
  }
}

/** Ruling R6 — "moved away" vs merely vacated. */
function kingsideVacancyByMovement(
  state: BoardState,
  bishopHome: Square,
  knightHome: Square,
): boolean {
  if (!KINGSIDE_CASTLE_REQUIRES_PIECES_MOVED) return true;
  return (
    (state.startPieceMoved[bishopHome] ?? false) &&
    (state.startPieceMoved[knightHome] ?? false)
  );
}

// ---------------------------------------------------------------------------
// Attacks & check
// ---------------------------------------------------------------------------

function enemyTeamOf(seat: Seat): 1 | 2 {
  return teamOf(seat) === 1 ? 2 : 1;
}

/**
 * Is `sq` attacked by any piece of `byTeam`? Attacks ignore halo state —
 * §6.3 lets a non-haloed piece complete a capture (then evaporate), so its
 * threats are real. Castling and pawn pushes never attack.
 */
export function isSquareAttacked(
  state: BoardState,
  sq: Square,
  byTeam: 1 | 2,
): boolean {
  const targetRank = rankOf(sq);
  const targetFile = fileOf(sq);

  // Knights
  for (const [dRank, dFile] of KNIGHT_OFFSETS) {
    const file = targetFile + dFile;
    if (!isValidFile(file)) continue;
    const from = squareOf(wrapRank(targetRank + dRank), file);
    const p = pieceAt(state, from);
    if (p && p.kind === "N" && teamOf(p.seat) === byTeam) return true;
  }

  // Straight rays outward from the target: rook/queen (any distance),
  // king (distance 1)
  for (const ray of ROOK_RAYS) {
    let rank = targetRank;
    let file = targetFile;
    for (let step = 1; step <= RANK_COUNT - 1; step++) {
      rank = wrapRank(rank - ray.dRank);
      file = file - ray.dFile;
      if (!isValidFile(file)) break;
      const from = squareOf(rank, file);
      if (from === sq) break;
      const p = pieceAt(state, from);
      if (!p) continue;
      if (teamOf(p.seat) === byTeam) {
        if (p.kind === "R" || p.kind === "Q") return true;
        if (p.kind === "K" && step === 1) return true;
      }
      break;
    }
  }

  // Diagonal rays: queen (no bounce), king (distance 1), pawns (distance 1,
  // direction-checked), and bishops via their bounce-aware generator run in
  // reverse — easiest correct form: generate each enemy bishop's moves and
  // test membership (bishops are ≤8 per game; paths ≤ a dozen squares).
  for (const ray of BISHOP_RAYS) {
    let rank = targetRank;
    let file = targetFile;
    for (let step = 1; step <= RANK_COUNT - 1; step++) {
      rank = wrapRank(rank - ray.dRank);
      file = file - ray.dFile;
      if (!isValidFile(file)) break;
      const from = squareOf(rank, file);
      if (from === sq) break;
      const p = pieceAt(state, from);
      if (!p) continue;
      if (teamOf(p.seat) === byTeam) {
        if (p.kind === "Q") return true;
        if (p.kind === "K" && step === 1) return true;
        if (p.kind === "P" && step === 1) {
          // The pawn attacks sq if sq is diagonally FORWARD of the pawn.
          const dir = pawnDirection(p.seat, rankOf(p.origin));
          if (wrapRank(rankOf(from) + dir) === targetRank) return true;
        }
      }
      break;
    }
  }

  // Bishops (bounce-aware). Attack mode: enemy kings still count as
  // reachable blockers (R12 removes them only as capture targets).
  for (let from = 0; from < state.board.length; from++) {
    const p = state.board[from];
    if (!p || p.kind !== "B" || teamOf(p.seat) !== byTeam) continue;
    const moves: Move[] = [];
    generateBishop(state, from, p, moves, isEnemy);
    if (moves.some((m) => m.to === sq)) return true;
  }

  return false;
}

export function kingSquare(state: BoardState, seat: Seat): Square {
  for (let sq = 0; sq < state.board.length; sq++) {
    const p = state.board[sq];
    if (p && p.kind === "K" && p.seat === seat) return sq;
  }
  throw new Error(`No king for seat ${seat}`);
}

/** §7.1 — check from the OPPOSING team only; partners never check (R9). */
export function isInCheck(state: BoardState, seat: Seat): boolean {
  return isSquareAttacked(state, kingSquare(state, seat), enemyTeamOf(seat));
}

// ---------------------------------------------------------------------------
// Single-move application (internal)
// ---------------------------------------------------------------------------

function cloneBoard(board: readonly (Piece | null)[]): (Piece | null)[] {
  return board.slice();
}

/**
 * Apply one submove mechanically (no legality checks; no turn bookkeeping).
 * Exported for staging/UX and used by applyTurn; the ONLY place board
 * mutation semantics live.
 */
export function applySubmove(
  state: BoardState,
  move: Move,
): BoardState {
  const board = cloneBoard(state.board);
  const mover = board[move.from];
  if (!mover) throw new Error(`applySubmove: no piece at ${move.from}`);

  let startPieceMoved = state.startPieceMoved;
  const markMoved = (piece: Piece) => {
    // GUARD (see state.ts): promoted pieces' origins alias other seats'
    // back-rank squares — never mark those.
    if (!piece.promoted && !startPieceMoved[piece.origin]) {
      const next = startPieceMoved.slice();
      next[piece.origin] = true;
      startPieceMoved = next;
    }
  };

  const epCreated: EpTarget[] = [];

  if (move.castle) {
    const setup = seatSetup(mover.seat);
    if (move.castle === "queenside") {
      const queenHome = squareOf(setup.queenBack, 3);
      const queen = board[queenHome];
      if (!queen) throw new Error("applySubmove: queenside castle without queen");
      board[move.from] = { ...queen, hasMoved: true };
      board[queenHome] = { ...mover, hasMoved: true };
      markMoved(mover);
      markMoved(queen);
    } else {
      const rank = setup.kingBack;
      const rookHome = squareOf(rank, 0);
      const bishopHome = squareOf(rank, 1);
      const rook = board[rookHome];
      if (!rook) throw new Error("applySubmove: kingside castle without rook");
      board[move.from] = null;
      board[rookHome] = { ...mover, hasMoved: true };
      board[bishopHome] = { ...rook, hasMoved: true };
      markMoved(mover);
      markMoved(rook);
    }
    return {
      ...state,
      board,
      startPieceMoved,
    };
  }

  // Capture (including en passant, where victim ≠ destination). A victim
  // taken unmoved on its home square leaves a GRAVE readable later from
  // startPieceMoved + the initial layout — no dedicated Avenger state.
  if (move.captures !== undefined) {
    board[move.captures] = null;
  }

  // Move (with promotion / halo / evaporation per computed effects)
  board[move.from] = null;
  markMoved(mover);
  if (move.evaporates) {
    // §6.3: the move completes — including the capture above — and the
    // piece is then removed. The destination ends empty.
    board[move.to] = null;
  } else if (move.promotion) {
    board[move.to] = {
      kind: move.promotion,
      seat: mover.seat,
      halo: true, // §8.3: a promoted piece ALWAYS earns a halo
      hasMoved: true,
      promoted: true,
      origin: move.to,
    };
  } else {
    board[move.to] = {
      ...mover,
      hasMoved: true,
      halo: mover.halo || move.earnsHalo === true,
    };
  }

  // Pawn double-step opens an EP window (§8.1)
  const mv = mover;
  if (mv.kind === "P" && move.path.length === 2 && move.captures === undefined) {
    epCreated.push({
      square: move.path[0] as Square,
      pawnSquare: move.to,
      bySeat: mv.seat,
      createdAtPly: state.ply,
    });
  }

  return {
    ...state,
    board,
    startPieceMoved,
    epTargets: [...state.epTargets, ...epCreated],
  };
}

// ---------------------------------------------------------------------------
// Pseudo-legal submoves for a seat, with effect-identical dedup
// ---------------------------------------------------------------------------

function generatePseudoMoves(state: BoardState, seat: Seat): Move[] {
  const out: Move[] = [];
  for (let sq = 0; sq < state.board.length; sq++) {
    const piece = state.board[sq];
    if (!piece || piece.seat !== seat) continue;
    switch (piece.kind) {
      case "P":
        generatePawn(state, sq, piece, out);
        break;
      case "N":
        generateKnight(state, sq, piece, out);
        break;
      case "B":
        generateBishop(state, sq, piece, out);
        break;
      case "R":
        generateSlides(state, sq, piece, ROOK_RAYS, RANK_COUNT - 1, out);
        break;
      case "Q":
        generateSlides(
          state, sq, piece,
          [...ROOK_RAYS, ...BISHOP_RAYS],
          RANK_COUNT - 1,
          out,
        );
        break;
      case "K":
        generateKing(state, sq, piece, out);
        break;
    }
  }
  return dedupEffectIdentical(out);
}

/**
 * Two generated moves with the same (from,to) and identical effects are one
 * move — keep the shorter path (the UX picks the shorter route silently).
 * Moves that differ in ANY effect stay distinct; rotDir disambiguates.
 */
export function dedupEffectIdentical(moves: Move[]): Move[] {
  const result: Move[] = [];
  for (const move of moves) {
    const twinIdx = result.findIndex(
      (m) => m.from === move.from && m.to === move.to && movesEffectIdentical(m, move),
    );
    if (twinIdx === -1) {
      result.push(move);
    } else {
      const twin = result[twinIdx] as Move;
      if (move.path.length < twin.path.length) result[twinIdx] = move;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Turn-level legality (§4.2 opening pairing, §7.1 self-check)
// ---------------------------------------------------------------------------

/** R8/R3: a submove's side of the mover's meridian, by origin square (king's origin for castles). */
export function submoveSide(seat: Seat, move: Move): "cw" | "ccw" {
  if (move.castle && CASTLE_OPENING_SIDE_ANCHOR === "queen") {
    // Alternate ruling: anchor on the queen's origin — the "to" square for
    // queenside; kingside doesn't cross so from-side === to-side anyway.
    return meridianSide(seat, rankOf(move.to));
  }
  return meridianSide(seat, rankOf(move.from));
}

function leavesOwnKingInCheck(state: BoardState, seat: Seat, move: Move): boolean {
  const after = applySubmove(state, move);
  return isInCheck(after, seat);
}

/**
 * Legal FIRST submoves (or the whole move post-opening) for the active seat.
 * Per R1, during the opening every submove must independently avoid
 * self-check.
 */
export function legalMoves(state: BoardState): Move[] {
  const seat = state.activeSeat;
  const pseudo = generatePseudoMoves(state, seat);
  const filtered = pseudo.filter((m) => !leavesOwnKingInCheck(state, seat, m));
  if (!inOpening(state)) return filtered;
  if (!OPENING_SUBMOVE_MUST_AVOID_SELF_CHECK) {
    // Alternate R1: first submoves need not independently avoid check —
    // but the COMPLETED turn must; filtering happens in legalTurns.
    return pseudo.filter((m) => hasCompletion(state, seat, m));
  }
  // A first submove is only playable if SOME second submove completes a
  // legal turn (§4.2 requires the pair).
  return filtered.filter((m) => hasCompletion(state, seat, m));
}

export function legalMovesFrom(state: BoardState, from: Square): Move[] {
  return legalMoves(state).filter((m) => m.from === from);
}

/** Legal second submoves given a chosen (legal) first submove. */
export function legalSecondSubmoves(state: BoardState, first: Move): Move[] {
  const seat = state.activeSeat;
  const firstSide = submoveSide(seat, first);
  const mid = applySubmove(state, first);
  const pseudo = generatePseudoMoves(mid, seat);
  return pseudo.filter((m) => {
    if (submoveSide(seat, m) === firstSide) return false; // §4.2: one per side
    // R11: may the SAME piece make both submoves (having crossed sides)?
    if (!OPENING_MAY_MOVE_SAME_PIECE_TWICE && m.from === first.to) return false;
    const finalState = applySubmove(mid, m);
    return !isInCheck(finalState, seat);
  });
}

function hasCompletion(state: BoardState, seat: Seat, first: Move): boolean {
  if (
    OPENING_SUBMOVE_MUST_AVOID_SELF_CHECK &&
    leavesOwnKingInCheck(state, seat, first)
  ) {
    return false;
  }
  return legalSecondSubmoves(state, first).length > 0;
}

/** Full enumeration of legal turns. Exhaustive — prefer hasAnyLegalTurn for status checks. */
export function legalTurns(state: BoardState): Turn[] {
  if (!inOpening(state)) {
    return legalMoves(state).map((m) => ({ submoves: [m] as const }));
  }
  const turns: Turn[] = [];
  const seat = state.activeSeat;
  const pseudo = generatePseudoMoves(state, seat);
  for (const first of pseudo) {
    if (
      OPENING_SUBMOVE_MUST_AVOID_SELF_CHECK &&
      leavesOwnKingInCheck(state, seat, first)
    ) {
      continue;
    }
    for (const second of legalSecondSubmoves(state, first)) {
      turns.push({ submoves: [first, second] as const });
    }
  }
  return turns;
}

/** Early-exit existence check — the §7.3/§8.4 terminal evaluation primitive. */
export function hasAnyLegalTurn(state: BoardState): boolean {
  if (!inOpening(state)) return legalMoves(state).length > 0;
  const seat = state.activeSeat;
  const pseudo = generatePseudoMoves(state, seat);
  for (const first of pseudo) {
    if (
      OPENING_SUBMOVE_MUST_AVOID_SELF_CHECK &&
      leavesOwnKingInCheck(state, seat, first)
    ) {
      continue;
    }
    if (legalSecondSubmoves(state, first).length > 0) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// applyTurn — the atomic unit (§4.2); Postgres orders, THIS decides legality
// ---------------------------------------------------------------------------

export interface TurnEvents {
  captures: number;
  pawnMoved: boolean;
  halosEarned: Square[];
  evaporations: Square[];
  avengerMoves: Square[];
  promotions: Square[];
}

export type ApplyTurnResult =
  | { ok: true; state: BoardState; events: TurnEvents }
  | { ok: false; error: string };

/**
 * Validate and apply a full turn for the active seat. Rejects anything not
 * in the legal set — this is the server's authority call.
 */
export function applyTurn(state: BoardState, turn: Turn): ApplyTurnResult {
  const seat = state.activeSeat;
  const opening = inOpening(state);
  const expected = opening ? 2 : 1;
  // Total-function guard: this is the server authority; malformed transport
  // shapes must reject, never throw.
  if (
    !turn ||
    !Array.isArray(turn.submoves) ||
    turn.submoves.some((m) => typeof m !== "object" || m === null)
  ) {
    return { ok: false, error: "Malformed turn" };
  }
  if (turn.submoves.length !== expected) {
    return {
      ok: false,
      error: `Turn must have ${expected} submove(s) at ply ${state.ply}`,
    };
  }

  // Re-derive the legal set and match by structural identity — never trust
  // caller-provided paths or effects.
  const first = findMatching(legalMoves(state), turn.submoves[0]);
  if (!first) return { ok: false, error: "Illegal first submove" };

  const events: TurnEvents = {
    captures: 0,
    pawnMoved: false,
    halosEarned: [],
    evaporations: [],
    avengerMoves: [],
    promotions: [],
  };

  let working = state;
  const applyOne = (mv: Move) => {
    const mover = working.board[mv.from];
    if (mover?.kind === "P") events.pawnMoved = true;
    if (mv.captures !== undefined) events.captures++;
    // §6.2: the halo IS earned at the move's conclusion even when §6.3 then
    // removes the piece — the record (and the † move's * mark) reflects it.
    if (mv.earnsHalo) events.halosEarned.push(mv.to);
    if (mv.evaporates) events.evaporations.push(mv.to);
    if (mv.avenger) events.avengerMoves.push(mv.to);
    if (mv.promotion) events.promotions.push(mv.to);
    working = applySubmove(working, mv);
  };

  applyOne(first);

  if (opening) {
    const secondRef = turn.submoves[1] as Move;
    const second = findMatching(legalSecondSubmoves(state, first), secondRef);
    if (!second) return { ok: false, error: "Illegal second submove" };
    applyOne(second);
  }

  if (isInCheck(working, seat)) {
    return { ok: false, error: "Turn leaves own king in check" };
  }

  // Turn bookkeeping: EP windows (R5 — only windows created THIS turn
  // survive), fifty-move clock (§8.6, one player-turn), repetition (§8.5).
  const newPly = state.ply + 1;
  const epTargets = working.epTargets.filter(
    (t) => t.createdAtPly === state.ply,
  );
  const zeroing = events.pawnMoved || events.captures > 0;
  const halfmoveClock = zeroing
    ? 0
    : state.halfmoveClock +
      (opening ? FIFTY_MOVE_INCREMENT_PER_OPENING_TURN : 1);

  const next: BoardState = {
    ...working,
    activeSeat: nextSeat(seat),
    ply: newPly,
    epTargets,
    halfmoveClock,
    repetition: state.repetition, // placeholder; keyed below
  };
  const key = positionKey(next);
  next.repetition = {
    ...state.repetition,
    [key]: (state.repetition[key] ?? 0) + 1,
  };

  return { ok: true, state: next, events };
}

function findMatching(legal: Move[], candidate: Move | MoveRef): Move | null {
  // Accept either a full Move (structural match on from/to/promotion/castle/
  // rotDir) or a compact MoveRef.
  const matches = legal.filter((m) =>
    "path" in candidate
      ? m.from === candidate.from &&
        m.to === candidate.to &&
        (m.promotion ?? null) === ((candidate).promotion ?? null) &&
        (m.castle ?? null) === ((candidate).castle ?? null) &&
        ((candidate).rotDir === undefined ||
          m.rotDir === (candidate).rotDir)
      : moveMatchesRef(m, candidate),
  );
  if (matches.length === 1) return matches[0] as Move;
  if (matches.length === 0) return null;
  // Ambiguous without rotDir — refuse rather than guess (the client must
  // disambiguate; the UI's "via ↻/↺" toggle exists for exactly this).
  return null;
}

/** Resolve a compact client TurnRef against the legal set. */
export function matchTurnRef(
  state: BoardState,
  ref: TurnRef,
): { ok: true; turn: Turn } | { ok: false; error: string } {
  const opening = inOpening(state);
  const expected = opening ? 2 : 1;
  if (
    !ref ||
    !Array.isArray(ref.submoves) ||
    ref.submoves.some((m) => typeof m !== "object" || m === null)
  ) {
    return { ok: false, error: "Malformed turn reference" };
  }
  if (ref.submoves.length !== expected) {
    return { ok: false, error: `Turn must have ${expected} submove(s)` };
  }
  const first = findMatching(legalMoves(state), ref.submoves[0]);
  if (!first) {
    return { ok: false, error: "First submove is illegal or ambiguous" };
  }
  if (!opening) return { ok: true, turn: { submoves: [first] as const } };
  const second = findMatching(
    legalSecondSubmoves(state, first),
    ref.submoves[1] as MoveRef,
  );
  if (!second) {
    return { ok: false, error: "Second submove is illegal or ambiguous" };
  }
  return { ok: true, turn: { submoves: [first, second] as const } };
}

// ---------------------------------------------------------------------------
// Position key (§8.5) — everything legal moves depend on
// ---------------------------------------------------------------------------

export function positionKey(state: BoardState): string {
  const parts: string[] = [String(STATE_SCHEMA_VERSION), String(state.activeSeat)];
  for (let sq = 0; sq < state.board.length; sq++) {
    const p = state.board[sq];
    if (!p) continue;
    parts.push(
      `${sq}:${p.kind}${p.seat}${p.halo ? "h" : ""}${p.hasMoved ? "" : "u"}${
        p.promoted ? "p" : ""
      }`,
    );
  }
  // startPieceMoved bits affect R6 castling rights for vacated squares and
  // §6.4 Avenger graves.
  let moved = "";
  for (let sq = 0; sq < state.startPieceMoved.length; sq += 4) {
    let nibble = 0;
    for (let bit = 0; bit < 4; bit++) {
      if (state.startPieceMoved[sq + bit]) nibble |= 1 << bit;
    }
    moved += nibble.toString(16);
  }
  parts.push(moved);
  // Open EP windows (only those actually live next turn matter).
  const eps = state.epTargets
    .map((t) => `${t.square}<${t.bySeat}@${t.createdAtPly}`)
    .sort()
    .join(",");
  parts.push(eps);
  return parts.join("|");
}
