/** Debug utility: print the initial position for square-by-square review. */
import { initialState, printBoard, listPieces } from "../src/index.js";

const state = initialState();
console.log(printBoard(state));
console.log("\n" + listPieces(state));
