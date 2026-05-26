import { test, expect } from '@playwright/test';

test.describe('Contacts Module', () => {
  test('should display contacts page shell and table structure', async ({ page }) => {
    await page.goto('/sabsms/contacts');
    
    // Check headings
    await expect(page.getByRole('heading', { name: 'Contacts' }).first()).toBeVisible();
    await expect(page.getByText('People')).toBeVisible();

    // The table or filter bar should be present
    await expect(page.locator('table')).toBeVisible();
    
    // Wait for network/data load, maybe check "Name", "Phone", "Consent" columns
    await expect(page.getByRole('columnheader', { name: 'Name' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Phone' }).first()).toBeVisible();
  });
});
