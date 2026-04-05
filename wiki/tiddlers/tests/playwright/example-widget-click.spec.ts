import { expect, test } from '@playwright/test';

test.describe('ExampleWidget click behavior', () => {
  test('increments click count when the widget is clicked', async ({ page }) => {
    await page.goto('/#PlaywrightExampleWidget');

    const widget = page.locator('.tc-example-widget');
    await expect(widget).toHaveText(/Clicks:\s*0\b/);

    await widget.click();
    await expect(widget).toHaveText(/Clicks:\s*1\b/);

    await widget.click();
    await expect(widget).toHaveText(/Clicks:\s*2\b/);
  });
});
