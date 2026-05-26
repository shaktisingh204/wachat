import { test, expect } from '@playwright/test';

test.describe('Suppressions Module', () => {
  test('should display suppressions page and table', async ({ page }) => {
    await page.goto('/sabsms/suppressions');
    
    // Check heading
    await expect(page.getByRole('heading', { name: 'Suppressions' }).first()).toBeVisible();
    await expect(page.getByText('Compliance')).first().toBeVisible();

    // Ensure the fallback or table loads
    await page.waitForLoadState('networkidle');

    // The data table should exist
    // Might take a moment due to Suspense, so wait for table
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  });
});
