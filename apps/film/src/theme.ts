/** Midnight Orrery tokens, verbatim from apps/web/src/app/globals.css. */
export const PALETTE = {
  bg: "#17130e",
  surface: "#211b14",
  surfaceRaised: "#2b241b",
  line: "#3c3327",
  text: "#efe6d6",
  textDim: "#b0a490",
  ruleRed: "#a8352a",
  boardCream: "#f0e6d2",
  boardUmber: "#b09a78",
  boardMeridian: "#a8352a",
  check: "#ff5a45",
  halo: "#f2d27c",
  evaporate: "#8fa6a0",
  success: "#8faf7e",
  lastMove: "#cbbfa4",
  pieceRed: "#b5342a",
  pieceBlue: "#2f62a8",
  pieceGold: "#c9962e",
  pieceBlack: "#26201a",
} as const;

export const SEAT_COLOR = { 1: "#e5705f", 2: "#c7bcac", 3: "#7fa9dc", 4: "#d9ae4e" } as const;
export const LACQUER = { 1: PALETTE.pieceRed, 2: PALETTE.pieceBlack, 3: PALETTE.pieceBlue, 4: PALETTE.pieceGold } as const;
