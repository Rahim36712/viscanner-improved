const { test, expect } = require("@playwright/test");

test.describe("SV Toggles and Plot Dragging E2E", () => {
  test.beforeEach(async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("http://localhost:3030");
    await page.waitForLoadState("domcontentloaded");

    expect(errors).toHaveLength(0);
  });

  test("should toggle all SV types (DEL, INV, INS, BND, DUP, sBND)", async ({ page }) => {
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 25000 });

    const svTypes = ["DEL", "INV", "INS", "BND", "DUP", "sBND"];
    for (const svType of svTypes) {
      const checkbox = page
        .locator("label.sv-visibility-option")
        .filter({ hasText: new RegExp(`^${svType}$`) })
        .locator("input[type='checkbox']");

      await expect(checkbox).toBeVisible();
      expect(await checkbox.isChecked()).toBe(true);

      await checkbox.click({ force: true });
      expect(await checkbox.isChecked()).toBe(false);

      await checkbox.click({ force: true });
      expect(await checkbox.isChecked()).toBe(true);
    }
  });

  test("should toggle filter modes (BED-matched vs All VCF)", async ({ page }) => {
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 25000 });

    const matchedRadio = page.locator("label:has-text('Wakhan Copy number BED') input[type='radio']");
    const allRadio = page.locator("label:has-text('All VCF SVs') input[type='radio']");

    await expect(matchedRadio).toBeVisible();
    await expect(allRadio).toBeVisible();

    expect(await matchedRadio.isChecked()).toBe(true);

    await allRadio.click({ force: true });
    expect(await allRadio.isChecked()).toBe(true);
    expect(await matchedRadio.isChecked()).toBe(false);

    await matchedRadio.click({ force: true });
    expect(await matchedRadio.isChecked()).toBe(true);
    expect(await allRadio.isChecked()).toBe(false);
  });

  test("should toggle HP2 plot visibility", async ({ page }) => {
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 25000 });

    const hp2Checkbox = page.locator("label:has-text(\"Phased HP2 SV's plot\") input[type='checkbox']");
    await expect(hp2Checkbox).toBeVisible();
    expect(await hp2Checkbox.isChecked()).toBe(true);

    await hp2Checkbox.click({ force: true });
    expect(await hp2Checkbox.isChecked()).toBe(false);

    await hp2Checkbox.click({ force: true });
    expect(await hp2Checkbox.isChecked()).toBe(true);
  });

  test("should persist toggled-off SV types and options when sliding/panning plot", async ({ page }) => {
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 25000 });

    const bndCheckbox = page
      .locator("label.sv-visibility-option")
      .filter({ hasText: /^BND$/ })
      .locator("input[type='checkbox']");

    const invCheckbox = page
      .locator("label.sv-visibility-option")
      .filter({ hasText: /^INV$/ })
      .locator("input[type='checkbox']");

    const delCheckbox = page
      .locator("label.sv-visibility-option")
      .filter({ hasText: /^DEL$/ })
      .locator("input[type='checkbox']");

    const hp2Checkbox = page.locator("label:has-text(\"Phased HP2 SV's plot\") input[type='checkbox']");

    if (await bndCheckbox.isChecked()) await bndCheckbox.click({ force: true });
    if (await invCheckbox.isChecked()) await invCheckbox.click({ force: true });
    if (await delCheckbox.isChecked()) await delCheckbox.click({ force: true });
    if (await hp2Checkbox.isChecked()) await hp2Checkbox.click({ force: true });

    expect(await bndCheckbox.isChecked()).toBe(false);
    expect(await invCheckbox.isChecked()).toBe(false);
    expect(await delCheckbox.isChecked()).toBe(false);
    expect(await hp2Checkbox.isChecked()).toBe(false);

    // Perform canvas drag / slide simulation
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 150, startY, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(500);

    // Verify toggles persist after dragging/panning/sliding
    expect(await bndCheckbox.isChecked()).toBe(false);
    expect(await invCheckbox.isChecked()).toBe(false);
    expect(await delCheckbox.isChecked()).toBe(false);
    expect(await hp2Checkbox.isChecked()).toBe(false);
  });
});
