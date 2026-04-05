import { expect, test } from '@playwright/test';

test.describe('ExampleWidget click behavior', () => {
  test('increments click count when the widget is clicked', async ({ page }) => {
    await page.goto('/#PlaywrightExampleWidget');

    const widget = page.locator('.tc-example-widget');
    await expect(widget).toHaveText('This is a widget! Clicks: 0');

    await widget.click();
    await expect(widget).toHaveText('This is a widget! Clicks: 1');

    await widget.click();
    await expect(widget).toHaveText('This is a widget! Clicks: 2');
  });
});
