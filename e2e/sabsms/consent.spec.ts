import { test, expect } from '@playwright/test';

test.describe('Consent Module', () => {
  test('should display consent log page and table', async ({ page }) => {
    await page.goto('/sabsms/consent');
    
    // Check heading
    await expect(page.getByRole('heading', { name: 'Consent log' }).first()).toBeVisible();
    await expect(page.getByText('Compliance')).first().toBeVisible();
    await expect(page.getByText('Every opt-in and opt-out')).first().toBeVisible();

    // The data table should exist
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  });
});
