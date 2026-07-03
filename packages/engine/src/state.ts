/**
 * Layer 1 — BoardState.
 *
 * Immutable snapshot of a game in progress: piece placement (with halo and
 * has-moved flags), whose turn, opening-phase tracking, en passant target,
 * castling rights, draw counters, and the capture log the Avenger rule needs.
 *
 * Filled in at milestone M1.
 */

export const ENGINE_VERSION = "0.1.0";
