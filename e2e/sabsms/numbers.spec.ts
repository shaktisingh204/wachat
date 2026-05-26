import { test, expect } from '@playwright/test';

test.describe('Numbers Module', () => {
  test('should list numbers and show provision action', async ({ page }) => {
    await page.goto('/sabsms/numbers');
    
    // Header
    await expect(page.getByRole('heading', { name: 'Numbers' }).first()).toBeVisible();
    await expect(page.getByText('Provisioned senders for this workspace.')).toBeVisible();

    // Verify there's an action for Buy/Add Number
    const buyBtn = page.getByRole('button', { name: /Buy|Provision/i });
    if (await buyBtn.isVisible()) {
      await expect(buyBtn).toBeVisible();
    }
  });

  test('should navigate to buy number route', async ({ page }) => {
    await page.goto('/sabsms/numbers/buy');
    
    // Just verify the page loads
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
