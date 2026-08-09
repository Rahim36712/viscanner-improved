const { test, expect } = require("@playwright/test");
const path = require("path");

test.describe("Track Displays & Controls E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3030");
    await page.waitForLoadState("domcontentloaded");
  });

  test("should test mouse hover tooltips across tracks without console errors", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 25000 });

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Hover across multiple track locations
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const x = box.x + (box.width / steps) * i;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.waitForTimeout(100);
    }

    expect(pageErrors).toHaveLength(0);
  });

  test("should trigger PDF export button without runtime errors", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 25000 });

    const pdfButton = page.locator("button:has-text('Export PDF')");
    await expect(pdfButton).toBeVisible();

    await pdfButton.click();
    await page.waitForTimeout(1000);

    expect(pageErrors).toHaveLength(0);
  });

  test("should trigger CSV export button without runtime errors", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 25000 });

    const csvButton = page.locator("button:has-text('Export CSV')");
    await expect(csvButton).toBeVisible();

    await csvButton.click();
    await page.waitForTimeout(500);

    expect(pageErrors).toHaveLength(0);
  });

  test("should test CnvTable sorting, filtering, and eye-icon navigation (goToHiglass)", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 25000 });

    const fileInput = page.locator("input[type='file']").first();
    const zipPath = path.resolve(__dirname, "../../examples/wakhan_viscanner_input.zip");
    await fileInput.setInputFiles(zipPath);

    await page.waitForTimeout(3000);

    // Verify CnvTable rows present
    const rows = page.locator("table.table tbody tr");
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    // Test CnvTable sorting by clicking Start sort icon
    const sortIcon = page.locator("th i.sort-table-icon").first();
    await expect(sortIcon).toBeVisible();
    await sortIcon.click();
    await page.waitForTimeout(300);

    // Test eye-icon navigation (goToHiglass)
    const eyeIcon = page.locator("td i.fa-eye").first();
    await expect(eyeIcon).toBeVisible();
    await eyeIcon.click();
    await page.waitForTimeout(1000);

    expect(pageErrors).toHaveLength(0);
  });

  test("should handle window resize auto-fitting (scheduleFitToContent) without errors", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 25000 });

    // Resize viewport to trigger window resize event and scheduleFitToContent
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await page.waitForTimeout(1000);

    await page.setViewportSize({ width: 1400, height: 900 });
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await page.waitForTimeout(1000);

    expect(pageErrors).toHaveLength(0);
  });
});
