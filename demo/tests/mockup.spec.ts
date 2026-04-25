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

test("mockup spotlight + gridReset", async ({ page }) => {
  await page.goto("/mockup");
  await page.evaluate(() => (window as any).M.spotlight("p3"));
  await page.waitForTimeout(900);  // settle into spotlight
  await page.screenshot({ path: "tests/screenshots/mockup-spotlight.png", fullPage: false });
  await page.evaluate(() => (window as any).M.gridReset());
  await page.waitForTimeout(800);  // settle back
  await page.screenshot({ path: "tests/screenshots/mockup-grid-reset.png", fullPage: false });
  // After reset, p3 transform should be cleared
  const transform = await page.locator("#mock-p3").evaluate(el => getComputedStyle(el).transform);
  expect(transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);
});
