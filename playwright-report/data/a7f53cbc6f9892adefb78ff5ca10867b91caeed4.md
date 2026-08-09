# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sv-toggles-and-drag.spec.js >> SV Toggles and Plot Dragging E2E >> should persist toggled-off SV types and options when sliding/panning plot
- Location: tests\e2e\sv-toggles-and-drag.spec.js:72:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.isChecked: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('label.sv-visibility-option').filter({ hasText: /^BND$/ }).locator('input[type=\'checkbox\']')

```

# Test source

```ts
  1   | const { test, expect } = require("@playwright/test");
  2   | 
  3   | test.describe("SV Toggles and Plot Dragging E2E", () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     const errors = [];
  6   |     page.on("pageerror", (err) => errors.push(err));
  7   | 
  8   |     await page.goto("http://localhost:3030");
  9   |     await page.waitForLoadState("domcontentloaded");
  10  | 
  11  |     expect(errors).toHaveLength(0);
  12  |   });
  13  | 
  14  |   test("should toggle all SV types (DEL, INV, INS, BND, DUP, sBND)", async ({ page }) => {
  15  |     const canvas = page.locator("canvas").first();
  16  |     await expect(canvas).toBeVisible({ timeout: 25000 });
  17  | 
  18  |     const svTypes = ["DEL", "INV", "INS", "BND", "DUP", "sBND"];
  19  |     for (const svType of svTypes) {
  20  |       const checkbox = page
  21  |         .locator("label.sv-visibility-option")
  22  |         .filter({ hasText: new RegExp(`^${svType}$`) })
  23  |         .locator("input[type='checkbox']");
  24  | 
  25  |       await expect(checkbox).toBeVisible();
  26  |       expect(await checkbox.isChecked()).toBe(true);
  27  | 
  28  |       await checkbox.uncheck();
  29  |       expect(await checkbox.isChecked()).toBe(false);
  30  | 
  31  |       await checkbox.check();
  32  |       expect(await checkbox.isChecked()).toBe(true);
  33  |     }
  34  |   });
  35  | 
  36  |   test("should toggle filter modes (BED-matched vs All VCF)", async ({ page }) => {
  37  |     const canvas = page.locator("canvas").first();
  38  |     await expect(canvas).toBeVisible({ timeout: 25000 });
  39  | 
  40  |     const matchedRadio = page.locator("label:has-text('Wakhan Copy number BED') input[type='radio']");
  41  |     const allRadio = page.locator("label:has-text('All VCF SVs') input[type='radio']");
  42  | 
  43  |     await expect(matchedRadio).toBeVisible();
  44  |     await expect(allRadio).toBeVisible();
  45  | 
  46  |     expect(await matchedRadio.isChecked()).toBe(true);
  47  | 
  48  |     await allRadio.check();
  49  |     expect(await allRadio.isChecked()).toBe(true);
  50  |     expect(await matchedRadio.isChecked()).toBe(false);
  51  | 
  52  |     await matchedRadio.check();
  53  |     expect(await matchedRadio.isChecked()).toBe(true);
  54  |     expect(await allRadio.isChecked()).toBe(false);
  55  |   });
  56  | 
  57  |   test("should toggle HP2 plot visibility", async ({ page }) => {
  58  |     const canvas = page.locator("canvas").first();
  59  |     await expect(canvas).toBeVisible({ timeout: 25000 });
  60  | 
  61  |     const hp2Checkbox = page.locator("label:has-text(\"Phased HP2 SV's plot\") input[type='checkbox']");
  62  |     await expect(hp2Checkbox).toBeVisible();
  63  |     expect(await hp2Checkbox.isChecked()).toBe(true);
  64  | 
  65  |     await hp2Checkbox.uncheck();
  66  |     expect(await hp2Checkbox.isChecked()).toBe(false);
  67  | 
  68  |     await hp2Checkbox.check();
  69  |     expect(await hp2Checkbox.isChecked()).toBe(true);
  70  |   });
  71  | 
  72  |   test("should persist toggled-off SV types and options when sliding/panning plot", async ({ page }) => {
  73  |     const canvas = page.locator("canvas").first();
  74  |     await expect(canvas).toBeVisible({ timeout: 25000 });
  75  | 
  76  |     const bndCheckbox = page
  77  |       .locator("label.sv-visibility-option")
  78  |       .filter({ hasText: /^BND$/ })
  79  |       .locator("input[type='checkbox']");
  80  | 
  81  |     const invCheckbox = page
  82  |       .locator("label.sv-visibility-option")
  83  |       .filter({ hasText: /^INV$/ })
  84  |       .locator("input[type='checkbox']");
  85  | 
  86  |     const delCheckbox = page
  87  |       .locator("label.sv-visibility-option")
  88  |       .filter({ hasText: /^DEL$/ })
  89  |       .locator("input[type='checkbox']");
  90  | 
  91  |     const hp2Checkbox = page.locator("label:has-text(\"Phased HP2 SV's plot\") input[type='checkbox']");
  92  | 
  93  |     await bndCheckbox.uncheck();
  94  |     await invCheckbox.uncheck();
  95  |     await delCheckbox.uncheck();
  96  |     await hp2Checkbox.uncheck();
  97  | 
> 98  |     expect(await bndCheckbox.isChecked()).toBe(false);
      |                              ^ Error: locator.isChecked: Test timeout of 60000ms exceeded.
  99  |     expect(await invCheckbox.isChecked()).toBe(false);
  100 |     expect(await delCheckbox.isChecked()).toBe(false);
  101 |     expect(await hp2Checkbox.isChecked()).toBe(false);
  102 | 
  103 |     // Perform canvas drag / slide simulation
  104 |     const box = await canvas.boundingBox();
  105 |     expect(box).not.toBeNull();
  106 | 
  107 |     const startX = box.x + box.width / 2;
  108 |     const startY = box.y + box.height / 2;
  109 | 
  110 |     await page.mouse.move(startX, startY);
  111 |     await page.mouse.down();
  112 |     await page.mouse.move(startX - 150, startY, { steps: 10 });
  113 |     await page.mouse.up();
  114 | 
  115 |     await page.waitForTimeout(500);
  116 | 
  117 |     // Verify toggles persist after dragging/panning/sliding
  118 |     expect(await bndCheckbox.isChecked()).toBe(false);
  119 |     expect(await invCheckbox.isChecked()).toBe(false);
  120 |     expect(await delCheckbox.isChecked()).toBe(false);
  121 |     expect(await hp2Checkbox.isChecked()).toBe(false);
  122 |   });
  123 | });
  124 | 
```