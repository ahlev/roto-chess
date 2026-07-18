/**
 * The DELIBERATELY NAIVE second move generator — an independent
 * implementation of Rulebook v3.1 used ONLY for differential testing.
 *
 * Rules of this file: no imports from src/legal.ts or src/geometry.ts logic
 * beyond plain data types. Everything — wrap math, meridian tables, side
 * logic, path walking, effects, check detection, even move application —
 * is re-derived from the rulebook, in a different code shape (recursive
 * walkers, brute-force scans). If this file and src/legal.ts agree across
 * hundreds of positions, both are probably right; where they disagree, one
 * of them is wrong and the fixture that decides which becomes permanent.
 */
import type { BoardState, Piece } from "../src/state.js";
import type { Seat } from "../src/geometry.js";

// -- independent geometry ----------------------------------------------------

const N = 32;
const wrap = (r: number) => ((r % N) + N) % N;
const rk = (sq: number) => Math.floor(sq / 4);
const fl = (sq: number) => sq % 4;
const sq = (r: number, f: number) => wrap(r) * 4 + f;
const okFile = (f: number) => f >= 0 && f <= 3;

/** Meridian boundary: the internal rank that BEGINS the clockwise side. */
const MER: Record<number, number> = { 1: 0, 2: 8, 3: 16, 4: 24 };
const team = (seat: number) => (seat === 1 || seat === 3 ? 1 : 2);
const sideOf = (seat: number, r: number) =>
  wrap(r - MER[seat]!) < 16 ? "cw" : "ccw";

/** Back ranks per seat: the ranks flanking its meridian. */
const BACKS: Record<number, [number, number]> = {
  1: [31, 0],
  2: [7, 8],
  3: [15, 16],
  4: [23, 24],
};

function enemyBackRanks(seat: number): number[] {
  const out: number[] = [];
  for (const s of [1, 2, 3, 4]) {
    if (team(s) !== team(seat)) out.push(...BACKS[s]!);
  }
  return out;
}

/**
 * §2.5–2.7 re-derived: which seat's piece starts on rank `r`? Each seat's
 * home ranks are its two back ranks plus the pawn rank outside each (every
 * file of those ranks is occupied at game start); other ranks start empty.
 */
function homeSeatOfRank(r: number): number | null {
  for (const s of [1, 2, 3, 4]) {
    const [ccw, cw] = BACKS[s]!;
    if (r === ccw || r === cw || r === wrap(ccw - 1) || r === wrap(cw + 1)) {
      return s;
    }
  }
  return null;
}

/** Does walking `steps` ranks from `from` in `dir` cross seat's own meridian? */
function crosses(seat: number, from: number, steps: number, dir: number): boolean {
  const b = MER[seat]!;
  for (let i = 0, r = from; i < steps; i++, r = wrap(r + dir)) {
    if (dir > 0 ? wrap(r + 1) === b : r === b) return true;
  }
  return false;
}

// -- naive move signature ----------------------------------------------------

export interface NaiveMove {
  from: number;
  to: number;
  captures: number | null;
  enPassant: boolean;
  promotion: string | null;
  castle: string | null;
  earnsHalo: boolean;
  evaporates: boolean;
  avenger: boolean;
}

export function sig(m: NaiveMove): string {
  return [
    m.from, m.to, m.captures ?? "-", m.enPassant ? "e" : "-",
    m.promotion ?? "-", m.castle ?? "-",
    m.earnsHalo ? "H" : "-", m.evaporates ? "X" : "-", m.avenger ? "A" : "-",
  ].join("|");
}

// -- naive walking -----------------------------------------------------------

interface Walk {
  to: number;
  captures: number | null;
  pathRanksVisited: number[];
  rankSteps: number;
  rankDir: number;
}

/**
 * R12: kings are never CAPTURE targets, but for attack testing a walk must
 * still "see" the king square (check detection). `forAttack` widens the
 * capture test accordingly.
 */
function canTake(occ: Piece, seat: number, forAttack: boolean): boolean {
  return team(occ.seat) !== team(seat) && (forAttack || occ.kind !== "K");
}

/** Straight-ray walker (rook/queen/king legs). */
function walkRay(
  state: BoardState,
  seat: number,
  from: number,
  dR: number,
  dF: number,
  max: number,
  forAttack = false,
): Walk[] {
  const out: Walk[] = [];
  let r = rk(from);
  let f = fl(from);
  const ranks: number[] = [];
  for (let i = 1; i <= max; i++) {
    r = wrap(r + dR);
    f += dF;
    if (!okFile(f)) break;
    const dest = sq(r, f);
    if (dest === from) break;
    ranks.push(r);
    const occ = state.board[dest];
    if (occ) {
      if (canTake(occ, seat, forAttack)) {
        out.push({ to: dest, captures: dest, pathRanksVisited: [...ranks], rankSteps: dR ? i : 0, rankDir: dR });
      }
      break;
    }
    out.push({ to: dest, captures: null, pathRanksVisited: [...ranks], rankSteps: dR ? i : 0, rankDir: dR });
  }
  return out;
}

/** Recursive banana-curl walker: one bounce budget, rulebook §5.4. */
function walkCurl(
  state: BoardState,
  seat: number,
  origin: number,
  r: number,
  f: number,
  dR: number,
  dF: number,
  bounces: number,
  ranks: number[],
  steps: number,
  out: Walk[],
  forAttack = false,
): void {
  let nf = f + dF;
  let ndf = dF;
  if (!okFile(nf)) {
    if (bounces === 0) return; // second rail contact already spent
    ndf = -dF;
    nf = f + ndf;
    if (!okFile(nf)) return;
    bounces -= 1;
  }
  const nr = wrap(r + dR);
  const dest = sq(nr, nf);
  if (dest === origin) return;
  const nRanks = [...ranks, nr];
  const occ = state.board[dest];
  if (occ) {
    if (canTake(occ, seat, forAttack)) {
      out.push({ to: dest, captures: dest, pathRanksVisited: nRanks, rankSteps: steps + 1, rankDir: dR });
    }
    return;
  }
  out.push({ to: dest, captures: null, pathRanksVisited: nRanks, rankSteps: steps + 1, rankDir: dR });
  // Bishop ends its move when it reaches a rail with no bounce left.
  if (bounces === 0 && (nf === 0 || nf === 3)) return;
  walkCurl(state, seat, origin, nr, nf, dR, ndf, bounces, nRanks, steps + 1, out, forAttack);
}

// -- naive per-piece generation ----------------------------------------------

function pieceWalks(
  state: BoardState,
  from: number,
  piece: Piece,
  forAttack = false,
): Walk[] {
  const out: Walk[] = [];
  const seat = piece.seat;
  switch (piece.kind) {
    case "R":
      for (const [dR, dF] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        out.push(...walkRay(state, seat, from, dR, dF, 31, forAttack));
      }
      break;
    case "Q":
      for (const dR of [-1, 0, 1]) {
        for (const dF of [-1, 0, 1]) {
          if (dR === 0 && dF === 0) continue;
          out.push(...walkRay(state, seat, from, dR, dF, 31, forAttack));
        }
      }
      break;
    case "K":
      for (const dR of [-1, 0, 1]) {
        for (const dF of [-1, 0, 1]) {
          if (dR === 0 && dF === 0) continue;
          out.push(...walkRay(state, seat, from, dR, dF, 1, forAttack));
        }
      }
      break;
    case "B":
      for (const dR of [1, -1] as const) {
        for (const dF of [1, -1] as const) {
          walkCurl(state, seat, from, rk(from), fl(from), dR, dF, 1, [], 0, out, forAttack);
        }
      }
      break;
    case "N":
      for (const a of [-2, -1, 1, 2]) {
        for (const b of [-2, -1, 1, 2]) {
          if (Math.abs(a) === Math.abs(b)) continue;
          const f = fl(from) + b;
          if (!okFile(f)) continue;
          const r = wrap(rk(from) + a);
          const dest = sq(r, f);
          const occ = state.board[dest];
          if (occ && !canTake(occ, seat, forAttack)) continue;
          out.push({
            to: dest,
            captures: occ ? dest : null,
            pathRanksVisited: [r],
            rankSteps: Math.abs(a),
            rankDir: Math.sign(a),
          });
        }
      }
      break;
    case "P": {
      const dir = sideOf(seat, rk(piece.origin)) === "cw" ? 1 : -1;
      const r = rk(from);
      const f = fl(from);
      const one = sq(r + dir, f);
      if (!state.board[one]) {
        out.push({ to: one, captures: null, pathRanksVisited: [wrap(r + dir)], rankSteps: 1, rankDir: dir });
        const two = sq(r + 2 * dir, f);
        if (!piece.hasMoved && !state.board[two]) {
          out.push({
            to: two, captures: null,
            pathRanksVisited: [wrap(r + dir), wrap(r + 2 * dir)],
            rankSteps: 2, rankDir: dir,
          });
        }
      }
      for (const dF of [-1, 1]) {
        if (!okFile(f + dF)) continue;
        const dest = sq(r + dir, f + dF);
        const occ = state.board[dest];
        if (occ && canTake(occ, seat, forAttack)) {
          out.push({ to: dest, captures: dest, pathRanksVisited: [wrap(r + dir)], rankSteps: 1, rankDir: dir });
        } else if (!occ) {
          // En passant: target open this turn, landing square matches.
          for (const t of state.epTargets) {
            if (state.ply !== t.createdAtPly + 1) continue;
            if (t.square !== dest) continue;
            const victim = state.board[t.pawnSquare];
            if (victim && team(victim.seat) !== team(seat)) {
              out.push({
                to: dest, captures: t.pawnSquare,
                pathRanksVisited: [wrap(r + dir)], rankSteps: 1, rankDir: dir,
              });
            }
          }
        }
      }
      break;
    }
  }
  return out;
}

const PRIMARY = new Set(["R", "B", "N"]);

/** Naive effect computation straight from §6.2–6.4. */
function toNaiveMoves(
  state: BoardState,
  from: number,
  piece: Piece,
  walks: Walk[],
): NaiveMove[] {
  const out: NaiveMove[] = [];
  const backs = enemyBackRanks(piece.seat);
  const promoRankFor = (): number => {
    const dir = sideOf(piece.seat, rk(piece.origin)) === "cw" ? 1 : -1;
    return dir === 1 ? wrap(MER[piece.seat]! + 7) : wrap(MER[piece.seat]! - 8);
  };
  for (const w of walks) {
    const isPawn = piece.kind === "P";
    const promotes = isPawn && rk(w.to) === promoRankFor();
    const promoChoices = promotes ? ["Q", "R", "B", "N"] : [null];
    for (const promo of promoChoices) {
      let earnsHalo = false;
      if (PRIMARY.has(piece.kind) && !piece.halo) {
        earnsHalo =
          w.captures !== null ||
          w.pathRanksVisited.some((r) => backs.includes(r));
      }
      const crossed =
        w.rankDir !== 0 &&
        crosses(piece.seat, rk(from), w.rankSteps, w.rankDir);
      let evaporates = false;
      let avenger = false;
      if (crossed && PRIMARY.has(piece.kind) && !piece.halo) {
        // §6.4 (ruled 2026-07-18): capture the intruder standing where an
        // own-team piece started, never moved, and is gone — died in place.
        const graveSeat = homeSeatOfRank(rk(w.to));
        const eligible =
          !piece.hasMoved &&
          !piece.promoted &&
          w.captures !== null &&
          graveSeat !== null &&
          team(graveSeat) === team(piece.seat) &&
          !(state.startPieceMoved[w.to] ?? false);
        if (eligible) avenger = true;
        else evaporates = true;
      }
      out.push({
        from,
        to: w.to,
        captures: w.captures,
        enPassant:
          isPawn && w.captures !== null && w.captures !== w.to,
        promotion: promo,
        castle: null,
        earnsHalo,
        evaporates,
        avenger,
      });
    }
  }
  return out;
}

/** Naive castling from §8.2, incl. ruling R6. */
function naiveCastles(state: BoardState, seat: number): NaiveMove[] {
  const out: NaiveMove[] = [];
  const kingCcw = seat === 1 || seat === 3;
  const cw = MER[seat]!;
  const backCw = cw;
  const backCcw = wrap(cw - 1);
  const kBack = kingCcw ? backCcw : backCw;
  const qBack = kingCcw ? backCw : backCcw;
  const kHome = sq(kBack, 3);
  const king = state.board[kHome];
  if (!king || king.kind !== "K" || king.seat !== seat || king.hasMoved) return out;
  if (naiveAttacked(state, kHome, seat)) return out;

  const qHome = sq(qBack, 3);
  const queen = state.board[qHome];
  if (queen && queen.kind === "Q" && queen.seat === seat && !queen.hasMoved) {
    if (!naiveAttacked(state, qHome, seat)) {
      out.push({
        from: kHome, to: qHome, captures: null, enPassant: false,
        promotion: null, castle: "queenside",
        earnsHalo: false, evaporates: false, avenger: false,
      });
    }
  }

  const rHome = sq(kBack, 0);
  const bHome = sq(kBack, 1);
  const nHome = sq(kBack, 2);
  const rook = state.board[rHome];
  if (
    rook && rook.kind === "R" && rook.seat === seat && !rook.hasMoved &&
    !state.board[bHome] && !state.board[nHome] &&
    (state.startPieceMoved[bHome] ?? false) &&
    (state.startPieceMoved[nHome] ?? false) &&
    !naiveAttacked(state, nHome, seat) &&
    !naiveAttacked(state, bHome, seat) &&
    !naiveAttacked(state, rHome, seat)
  ) {
    out.push({
      from: kHome, to: rHome, captures: null, enPassant: false,
      promotion: null, castle: "kingside",
      earnsHalo: false, evaporates: false, avenger: false,
    });
  }
  return out;
}

/** Is `target` attacked by any piece of the team OPPOSING `seat`? Brute force. */
function naiveAttacked(state: BoardState, target: number, seat: number): boolean {
  for (let from = 0; from < 128; from++) {
    const p = state.board[from];
    if (!p || team(p.seat) === team(seat)) continue;
    if (p.kind === "P") {
      // Pawns attack ONLY their two forward diagonals — pushes never attack.
      const dir = sideOf(p.seat, rk(p.origin)) === "cw" ? 1 : -1;
      const fr = rk(from);
      const ff = fl(from);
      for (const dF of [-1, 1]) {
        if (okFile(ff + dF) && sq(fr + dir, ff + dF) === target) return true;
      }
      continue;
    }
    if (
      pieceWalks(state, from, p, true).some(
        (w) => w.to === target || w.captures === target,
      )
    ) {
      return true;
    }
  }
  return false;
}

/** Naive apply — just enough to test self-check; different shape from src. */
export function naiveApply(state: BoardState, m: NaiveMove): BoardState {
  const board = state.board.slice();
  const mover = board[m.from]!;
  if (m.castle === "queenside") {
    const q = board[m.to]!;
    board[m.from] = { ...q, hasMoved: true };
    board[m.to] = { ...mover, hasMoved: true };
    return { ...state, board };
  }
  if (m.castle === "kingside") {
    const rook = board[m.to]!; // king's destination IS the rook home
    board[m.from] = null;
    board[m.to] = { ...mover, hasMoved: true };
    board[sq(rk(m.to), 1)] = { ...rook, hasMoved: true };
    return { ...state, board };
  }
  if (m.captures !== null) board[m.captures] = null;
  board[m.from] = null;
  if (m.evaporates) {
    board[m.to] = null;
  } else if (m.promotion) {
    board[m.to] = {
      kind: m.promotion as Piece["kind"], seat: mover.seat,
      halo: true, hasMoved: true, promoted: true, origin: m.to,
    };
  } else {
    board[m.to] = { ...mover, hasMoved: true, halo: mover.halo || m.earnsHalo };
  }
  return { ...state, board };
}

function naiveKingSq(state: BoardState, seat: number): number {
  for (let i = 0; i < 128; i++) {
    const p = state.board[i];
    if (p && p.kind === "K" && p.seat === seat) return i;
  }
  throw new Error("naive: no king");
}

export function naiveInCheck(state: BoardState, seat: number): boolean {
  return naiveAttacked(state, naiveKingSq(state, seat), seat);
}

/**
 * Naive legal submoves for the active seat: pseudo-legal + self-check
 * filter. (Opening pair-completion is checked by the caller when needed.)
 */
export function naiveLegalSubmoves(state: BoardState): NaiveMove[] {
  const seat = state.activeSeat;
  const all: NaiveMove[] = [];
  for (let from = 0; from < 128; from++) {
    const p = state.board[from];
    if (!p || p.seat !== seat) continue;
    all.push(...toNaiveMoves(state, from, p, pieceWalks(state, from, p)));
  }
  all.push(...naiveCastles(state, seat));
  return all.filter((m) => !naiveInCheck(naiveApply(state, m), seat));
}

/**
 * Naive first-submoves during the opening: additionally require that some
 * second submove on the OTHER side (by origin square; king's origin for
 * castles) completes a legal pair.
 */
export function naiveLegalOpeningFirsts(state: BoardState): NaiveMove[] {
  const seat = state.activeSeat as Seat;
  return naiveLegalSubmoves(state).filter((first) => {
    const firstSide = sideOf(seat, rk(first.from));
    const mid = naiveApply(state, first);
    return naiveLegalSubmoves({ ...mid, activeSeat: seat }).some(
      (second) => sideOf(seat, rk(second.from)) !== firstSide,
    );
  });
}

/** Dedup naive signatures (both directions to one destination with equal effects = one). */
export function naiveSignatureSet(moves: NaiveMove[]): Set<string> {
  return new Set(moves.map(sig));
}
