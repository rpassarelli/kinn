import { test, expect } from "@playwright/test";

test("mockup page renders 5 panels + control panel + window.M API", async ({ page }) => {
  await page.goto("/mockup");
  for (const id of ["p1", "p2", "p3", "p4", "p5"]) {
    await expect(page.locator(`#mock-${id}`)).toBeVisible();
  }
  await expect(page.locator(".mock-controls")).toBeVisible();
  // Default-selected chips
  await expect(page.locator('.chip-row[data-role="target"] [data-pid="p1"].active')).toBeVisible();
  await expect(page.locator('.chip-row[data-role="from"] [data-pid="p1"].active')).toBeVisible();
  await expect(page.locator('.chip-row[data-role="to"] [data-pid="p2"].active')).toBeVisible();
  // window.M API still exposed
  const helpExists = await page.evaluate(() => typeof (window as any).M?.help === "function");
  expect(helpExists).toBe(true);
  await page.screenshot({ path: "tests/screenshots/mockup-initial.png", fullPage: false });
});

test("mockup buttons trigger commands", async ({ page }) => {
  await page.goto("/mockup");
  // Select target P3, click Spotlight
  await page.click('.chip-row[data-role="target"] [data-pid="p3"]');
  await page.click('[data-cmd="spotlight"]');
  await page.waitForTimeout(900);
  // P3 should be transformed (non-identity matrix)
  const transform = await page.locator("#mock-p3").evaluate(el => getComputedStyle(el).transform);
  expect(transform).not.toBe("none");
  expect(transform).not.toBe("matrix(1, 0, 0, 1, 0, 0)");
  await page.screenshot({ path: "tests/screenshots/mockup-buttons.png", fullPage: false });
  // Reset
  await page.click('[data-cmd="grid-reset"]');
  await page.waitForTimeout(900);
});

test("mockup commands: highlight + arrow + particles + caption", async ({ page }) => {
  await page.goto("/mockup");
  await page.evaluate(() => {
    const M = (window as any).M;
    M.highlight("p1");
    M.arrow("p1", "p2");
    M.particles("p2", "p4", 5);
    M.caption("the model hears the user", "01 → 02 · HEARING");
  });
  await page.waitForTimeout(700);  // capture mid-flight (arrow drawing, particles in-air)
  // Caption should be visible
  const opacity = await page.locator("#mock-caption").evaluate(el => parseFloat(getComputedStyle(el).opacity));
  expect(opacity).toBeGreaterThan(0.7);
  // At least one arrow path in the SVG
  const arrowCount = await page.locator(".mock-arrow-path").count();
  expect(arrowCount).toBeGreaterThanOrEqual(1);
  await page.screenshot({ path: "tests/screenshots/mockup-commands.png", fullPage: false });
});

test("spotlight P1 → side mode (panel left, caption right)", async ({ page }) => {
  await page.goto("/mockup");
  await page.evaluate(() => (window as any).M.spotlight("p1", "01 · THE SURFACE",
    "It looks like a simple chat with an AI. The stakeholder just talks."));
  await page.waitForTimeout(1500); // panel settle + caption appear
  await page.screenshot({ path: "tests/screenshots/spotlight-p1-side.png", fullPage: false });

  // Caption should sit to the right of the spotlit panel (no overlap)
  const main = await page.locator("main").boundingBox();
  const cap = await page.locator("#mock-caption").boundingBox();
  const panel = await page.locator("#mock-p1").boundingBox();
  if (!main || !cap || !panel) throw new Error("layout missing");
  expect(cap.x).toBeGreaterThan(panel.x + panel.width * 0.9);
});

test("spotlight P3 → below mode (panel top, caption below)", async ({ page }) => {
  await page.goto("/mockup");
  await page.evaluate(() => (window as any).M.spotlight("p3", "03 · THE MODEL",
    "Six cybernetic dimensions of the business."));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "tests/screenshots/spotlight-p3-below.png", fullPage: false });

  // Caption should be in the lower half of main
  const main = await page.locator("main").boundingBox();
  const cap = await page.locator("#mock-caption").boundingBox();
  if (!main || !cap) throw new Error("layout missing");
  expect(cap.y).toBeGreaterThan(main.y + main.height * 0.55);
});

test("spotlight toggles off when called twice on the same panel", async ({ page }) => {
  await page.goto("/mockup");
  // First call → on
  await page.evaluate(() => (window as any).M.spotlight("p2", "step", "hello"));
  await page.waitForTimeout(1200);
  let active = await page.evaluate(() => (window as any).M.spotlightActive);
  expect(active).toBe("p2");
  // Second call same panel → off
  await page.evaluate(() => (window as any).M.spotlight("p2"));
  await page.waitForTimeout(1000);
  active = await page.evaluate(() => (window as any).M.spotlightActive);
  expect(active).toBeNull();
  // Panel transform cleared
  const transform = await page.locator("#mock-p2").evaluate(el => getComputedStyle(el).transform);
  expect(transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);
  await page.screenshot({ path: "tests/screenshots/spotlight-toggle-off.png", fullPage: false });
});
