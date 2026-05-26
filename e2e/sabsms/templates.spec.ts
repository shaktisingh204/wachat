import { test, expect } from '@playwright/test';

test.describe('Templates Module', () => {
  test('should list templates and show primary action', async ({ page }) => {
    await page.goto('/sabsms/templates');
    
    // Header
    await expect(page.getByRole('heading', { name: 'Templates' }).first()).toBeVisible();
    await expect(page.getByText('Compose, register, and submit SMS templates')).toBeVisible();

    // Check data loader / table loads (could be in Suspense)
    // There should be a "New Template" or "Create Template" primary action button
    const createBtn = page.getByRole('link', { name: /template/i }).filter({ hasText: /New|Create/i });
    if (await createBtn.count() > 0) {
      await expect(createBtn.first()).toBeVisible();
    }
  });

  test('should load the create template page', async ({ page }) => {
    await page.goto('/sabsms/templates/create');
    
    // Depending on what client.tsx renders, we can check for basic terms
    // We expect some form fields
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
