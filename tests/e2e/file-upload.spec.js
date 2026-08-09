const { test, expect } = require("@playwright/test");
const path = require("path");

test.describe("File Upload E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3030");
    await page.waitForLoadState("domcontentloaded");
  });

  test("should upload valid Wakhan input zip file cleanly without console exceptions", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 25000 });

    const fileInput = page.locator("input[type='file']").first();
    await expect(fileInput).toBeAttached();

    const zipPath = path.resolve(__dirname, "../../examples/wakhan_viscanner_input.zip");
    await fileInput.setInputFiles(zipPath);

    await page.waitForTimeout(3000);
    await expect(canvas).toBeVisible();
    expect(pageErrors).toHaveLength(0);
  });

  test("should upload valid example zip file cleanly without console exceptions", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 25000 });

    const fileInput = page.locator("input[type='file']").first();
    await expect(fileInput).toBeAttached();

    const zipPath = path.resolve(__dirname, "../../examples/viscanner_example.zip");
    await fileInput.setInputFiles(zipPath);

    await page.waitForTimeout(3000);
    await expect(canvas).toBeVisible();
    expect(pageErrors).toHaveLength(0);
  });

  test("should display user-friendly alert on uploading invalid RAR file without uncaught JS exceptions", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    let dialogMessage = "";
    let dialogTriggered = false;

    page.on("dialog", async (dialog) => {
      dialogTriggered = true;
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 25000 });

    const fileInput = page.locator("input[type='file']").first();
    await expect(fileInput).toBeAttached();

    const invalidRarPath = path.resolve(__dirname, "../fixtures/invalid_rar.zip");
    await fileInput.setInputFiles(invalidRarPath);

    await page.waitForTimeout(1500);

    expect(dialogTriggered).toBe(true);
    expect(dialogMessage).toContain("This file is a RAR archive, not a real ZIP");
    expect(pageErrors).toHaveLength(0);
  });

  test("should display user-friendly alert on uploading corrupted zip file without uncaught JS exceptions", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    let dialogMessage = "";
    let dialogTriggered = false;

    page.on("dialog", async (dialog) => {
      dialogTriggered = true;
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 25000 });

    const fileInput = page.locator("input[type='file']").first();
    await expect(fileInput).toBeAttached();

    const corruptedZipPath = path.resolve(__dirname, "../fixtures/corrupted.zip");
    await fileInput.setInputFiles(corruptedZipPath);

    await page.waitForTimeout(1500);

    expect(dialogTriggered).toBe(true);
    expect(dialogMessage).toContain("ViScanner could not read this archive as a ZIP file");
    expect(pageErrors).toHaveLength(0);
  });
});
