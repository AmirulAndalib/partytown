import { test, expect } from '@playwright/test';

test('iframe', async ({ page }) => {
  await page.goto('/iframe/');

  await page.waitForSelector('.testSrc');
  const testSrc = page.locator('#testSrc');
  await expect(testSrc).toHaveText('/iframe/content.html');

  await page.waitForSelector('.testOnload');
  const testOnload = page.locator('#testOnload');
  await expect(testOnload).toHaveText('load');

  await page.waitForSelector('.testContentWindow');
  const testContentWindow = page.locator('#testContentWindow');
  await expect(testContentWindow).toHaveText('contentWindow');

  await page.waitForSelector('.testContentDocument');
  const testContentDocument = page.locator('#testContentDocument');
  await expect(testContentDocument).toHaveText('contentDocument');

  await page.waitForSelector('.testGetSomeGlobalVar');
  const testGetSomeGlobalVar = page.locator('#testGetSomeGlobalVar');
  await expect(testGetSomeGlobalVar).toHaveText('88');

  await page.waitForSelector('.testSetSomeGlobalVar', { state: 'attached' });
  const testSetSomeGlobalVar = page.locator('#testSetSomeGlobalVar');
  await expect(testSetSomeGlobalVar).toHaveText('99');

  await page.waitForSelector('.testSetSomeWindowVar', { state: 'attached' });
  const testSetSomeWindowVar = page.locator('#testSetSomeWindowVar');
  await expect(testSetSomeWindowVar).toHaveText('1985');

  await page.waitForSelector('.testTopSomeValue');
  const testTopSomeValue = page.locator('#testTopSomeValue');
  await expect(testTopSomeValue).toHaveText('1956.21');

  await page.waitForSelector('.testScriptWindowParent');
  const testScriptWindowParent = page.locator('#testScriptWindowParent');
  await expect(testScriptWindowParent).toHaveText('3770');

  await page.waitForSelector('.testCurrentScript');
  const testCurrentScript = page.locator('#testCurrentScript');
  await expect(testCurrentScript).toHaveText('/iframe/current-script.js');

  await page.waitForSelector('.testScriptOnload');
  const testScriptOnload = page.locator('#testScriptOnload');
  await expect(testScriptOnload).toHaveText('load');

  // await page.waitForSelector('.testMemberNames');
  // const testMemberNames = page.locator('#testMemberNames');
  // await expect(testMemberNames).toHaveText('1985');
});
