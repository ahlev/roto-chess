/**
 * Screenshot capture for milestone review — initial position (desktop +
 * 375px mobile) and a mid-game position, written to e2e/shots/.
 */
import { test } from "@playwright/test";
import { join } from "node:path";

const shotsDir = join(__dirname, "shots");

test("capture initial board", async ({ page }, testInfo) => {
  await page.goto("/hotseat");
  await page.waitForTimeout(600); // fonts + sprites settle
  await page.screenshot({
    path: join(shotsDir, `initial-${testInfo.project.name}.png`),
    fullPage: false,
  });
});
