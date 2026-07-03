/**
 * M4 gate — a complete four-player game (the engine-generated golden
 * showcase: opening double-moves through checkmate, including halo,
 * evaporation, castling, en passant, and promotion) is played end-to-end
 * through the REAL UI by tapping squares and confirming moves.
 */
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyTurn,
  initialState,
  parseGame,
  type BoardState,
  type Move,
  type Seat,
} from "@rotochess/engine";

// Use the app's own geometry tables (pure TS) — no mirrored constants that
// can drift. Any geometry change breaks these imports loudly at compile.
import {
  SQUARES,
  VIEWBOX,
  CENTER,
  polarPoint,
  rotationForSeat,
} from "../src/components/board/board-geometry";

function squareScreenPoint(
  sq: number,
  orientation: Seat,
  box: { x: number; y: number; width: number; height: number },
): { x: number; y: number } {
  const g = SQUARES[sq];
  if (!g) throw new Error(`bad square ${sq}`);
  const p = polarPoint(g.midDeg + rotationForSeat(orientation), g.midR);
  const scale = box.width / VIEWBOX;
  return { x: box.x + p.x * scale, y: box.y + p.y * scale };
}
void CENTER;

async function playSubmove(
  page: Page,
  move: Move,
  orientation: Seat,
): Promise<void> {
  const board = page.getByRole("group", { name: "Roto Chess board" });
  const box = await board.boundingBox();
  if (!box) throw new Error("board not visible");
  const from = squareScreenPoint(move.from, orientation, box);
  const to = squareScreenPoint(move.to, orientation, box);
  await page.mouse.click(from.x, from.y);
  await page.mouse.click(to.x, to.y);
  // Disambiguate promotion / rotational direction when the picker appears.
  const opt = page.getByTestId(
    `opt-${move.promotion ?? "x"}-${move.rotDir ?? 0}`,
  );
  if (await opt.isVisible().catch(() => false)) {
    await opt.click();
  }
  await page.getByTestId("confirm-move").click();
}

function loadShowcase() {
  const text = readFileSync(
    join(
      __dirname,
      "../../../packages/engine/test/goldens/golden-showcase.rpgn",
    ),
    "utf8",
  );
  return parseGame(text);
}

test("golden showcase game plays through the UI to checkmate", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "full replay runs on desktop");
  const { turns } = loadShowcase();
  expect(turns.length).toBeGreaterThan(10);

  await page.goto("/hotseat");
  await expect(page.getByTestId("status-line")).toContainText("North to move");

  let state: BoardState = initialState();
  for (const turn of turns) {
    const orientation = state.activeSeat; // rotate-to-player is default ON
    for (const sub of turn.submoves) {
      await playSubmove(page, sub as Move, orientation);
    }
    const applied = applyTurn(state, turn);
    if (!applied.ok) throw new Error(applied.error);
    state = applied.state;
  }

  await expect(page.getByTestId("result-line")).toContainText(
    "take the crown",
    { timeout: 15_000 },
  );
  // The captures tray has logged the fallen: the showcase makes many
  // captures (and an evaporation), so it must be visible and non-empty.
  const tray = page.getByTestId("captures-tray");
  await expect(tray).toBeVisible();
  expect(await tray.getByRole("listitem").count()).toBeGreaterThan(0);
  await page.screenshot({
    path: testInfo.outputPath("final-desktop.png"),
    fullPage: true,
  });
});

test("mobile 375px: opening round is playable and legible", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only check");
  const { turns } = loadShowcase();

  await page.goto("/hotseat");
  let state: BoardState = initialState();
  // Play the first full round (4 opening turns, 8 submoves) by tapping.
  for (const turn of turns.slice(0, 4)) {
    const orientation = state.activeSeat;
    for (const sub of turn.submoves) {
      await playSubmove(page, sub as Move, orientation);
    }
    const applied = applyTurn(state, turn);
    if (!applied.ok) throw new Error(applied.error);
    state = applied.state;
  }
  await expect(page.getByTestId("status-line")).toContainText("North to move");
  await page.screenshot({
    path: testInfo.outputPath("mobile-375.png"),
    fullPage: true,
  });
});
