import { expect, test } from '@playwright/test';

test.describe('ExampleWidget', () => {
  test('renders RandomNumber widget output on the test tiddler', async ({ page }) => {
    await page.goto('/#PlaywrightExampleWidget');

    const widget = page.locator('.tc-example-widget');
    await expect(widget).toHaveText('This is a widget! Clicks: 0');
  });
});
