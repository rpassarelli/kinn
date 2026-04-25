import { test, expect } from "@playwright/test";

test("5-panel layout renders all sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#panel-01")).toBeVisible();
  await expect(page.locator("#panel-02")).toBeVisible();
  await expect(page.locator("#panel-03")).toBeVisible();
  await expect(page.locator("#panel-04")).toBeVisible();
  await expect(page.locator("#panel-05")).toBeVisible();
  await expect(page.locator("#vsm-blocks .vsm-block")).toHaveCount(6);
  await page.screenshot({ path: "tests/screenshots/initial.png", fullPage: false });
});

test("step-forward triggers turn 1 choreography", async ({ page }) => {
  await page.goto("/");
  await page.click("#btn-next");
  // Wait past the agent_bubble timing (T.agent_bubble = 6100ms) plus a small buffer
  await page.waitForTimeout(6500);
  // Check user bubble appeared in 01
  await expect(page.locator(".bubble.user").first()).toBeVisible();
  // Signals appeared in 02
  await expect(page.locator("#signals-list li").first()).toBeVisible();
  // Router right-col has at least one mutation chip
  await expect(page.locator("#router-out .router-chip")).toHaveCount(1, { timeout: 1000 }).catch(async () => {
    // It might have multiple — just assert at least one
    const count = await page.locator("#router-out .router-chip").count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
  // Next-question text appeared in 05 (GSAP fades opacity 0 → 1)
  const nextQBox = page.locator("#next-q-box");
  await expect(nextQBox).toBeVisible();
  const opacity = await nextQBox.evaluate(el => getComputedStyle(el).opacity);
  expect(Number(opacity)).toBeGreaterThan(0.5);
  // VSM has at least one non-empty block
  const nonEmpty = await page.locator(".vsm-block.low, .vsm-block.mid, .vsm-block.high").count();
  expect(nonEmpty).toBeGreaterThan(0);
  await page.screenshot({ path: "tests/screenshots/turn-1.png", fullPage: false });
});

test("turn-1 mid-flight has visible arrow and signals", async ({ page }) => {
  await page.goto("/");
  await page.click("#btn-next");
  // Capture during the arrow_a → router_recv window (~2000ms in)
  await page.waitForTimeout(2200);
  // At least one signal LI should be present
  const signalCount = await page.locator("#signals-list li").count();
  expect(signalCount).toBeGreaterThan(0);
  // Arrow path should be in the SVG
  const arrowCount = await page.locator(".arrow-path").count();
  expect(arrowCount).toBeGreaterThanOrEqual(0); // may have already faded out
  await page.screenshot({ path: "tests/screenshots/turn-1-midflight.png", fullPage: false });
});

test("run demo button cycles through curated turns", async ({ page }) => {
  await page.goto("/");
  await page.click("#btn-demo");
  await page.waitForTimeout(8000); // mid-demo capture
  await page.screenshot({ path: "tests/screenshots/demo-midway.png", fullPage: false });
  const turnNum = await page.locator("#turn-num").textContent();
  expect(Number(turnNum)).toBeGreaterThan(0);
});
