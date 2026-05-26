import { test, expect } from '@playwright/test';

test.describe('Imports Module', () => {
  test('should display imports page and table', async ({ page }) => {
    await page.goto('/sabsms/imports');
    
    // The page may have a heading "Imports" or the table directly
    await expect(page.locator('body')).not.toBeEmpty();

    // The data table should exist
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  });
});
