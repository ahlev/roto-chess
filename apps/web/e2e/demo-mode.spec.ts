/**
 * M6 — demo-mode degradation: without Supabase env vars every networked
 * surface explains itself (in the secretary voice) and routes the player to
 * hotseat instead of crashing. (Live two-browser realtime sync is a
 * GOING-LIVE founder step — it needs a real Supabase project.)
 *
 * These specs only apply in demo mode: once real Supabase env is configured
 * the same routes serve live surfaces, so the suite skips itself.
 */
import { expect, test } from "@playwright/test";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const demoMode = !supabaseUrl.startsWith("https://");

test.describe("demo-mode surfaces", () => {
  test.skip(!demoMode, "Supabase env configured — demo-mode surfaces don't render");

  test("dashboard explains demo mode and offers hotseat", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByText("not seating members here just yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Play hotseat" })).toBeVisible();
  });

  test("login explains demo mode", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("not seating members here just yet")).toBeVisible();
  });

  test("join page explains demo mode", async ({ page }) => {
    await page.goto("/join/ROTO-ABCDE");
    await expect(page.getByText("not seating members here just yet")).toBeVisible();
  });
});
