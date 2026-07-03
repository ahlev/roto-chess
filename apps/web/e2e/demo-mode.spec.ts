/**
 * M6 — demo-mode degradation: without Supabase env vars every networked
 * surface explains itself and routes the player to hotseat instead of
 * crashing. (Live two-browser realtime sync is a GOING-LIVE founder step —
 * it needs a real Supabase project.)
 */
import { expect, test } from "@playwright/test";

test.describe("demo-mode surfaces", () => {
  test("dashboard explains demo mode and offers hotseat", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByText("without a backend")).toBeVisible();
    await expect(page.getByRole("link", { name: "Play hotseat" })).toBeVisible();
  });

  test("login explains demo mode", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("accounts are switched off")).toBeVisible();
  });

  test("join page explains demo mode", async ({ page }) => {
    await page.goto("/join/ROTO-ABCDE");
    await expect(page.getByText("without a backend")).toBeVisible();
  });
});
