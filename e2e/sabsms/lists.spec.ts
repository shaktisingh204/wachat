import { test, expect } from '@playwright/test';

test.describe('Lists Module', () => {
  test('should display lists page shell and datatable', async ({ page }) => {
    await page.goto('/sabsms/lists');
    
    // Check heading and eyebrow
    await expect(page.getByRole('heading', { name: 'Lists' }).first()).toBeVisible();
    await expect(page.getByText('Audiences')).toBeVisible();

    // Verify "New list" button exists
    const newListBtn = page.getByRole('button', { name: /New list/i });
    await expect(newListBtn).toBeVisible();

    // Check table headers
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Contacts' }).first()).toBeVisible();
  });
});
