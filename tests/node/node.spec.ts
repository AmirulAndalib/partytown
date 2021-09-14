import { test, expect } from '@playwright/test';

test('node', async ({ page }) => {
  await page.goto('/node/');

  await page.waitForSelector('.completed');

  const testCheckbox = page.locator('#testCheckbox');
  await expect(testCheckbox).toBeChecked();

  const testText = page.locator('#testText');
  await expect(testText).toHaveText('Hello World');

  const testRemove = page.locator('#testRemove');
  await expect(testRemove).toHaveText('This is awesome');

  const testHrefProp = page.locator('#testHrefProp');
  await expect(testHrefProp).toHaveText('undefined');
});
