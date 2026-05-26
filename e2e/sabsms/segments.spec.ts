import { test, expect } from '@playwright/test';

test.describe('Segments Module', () => {
  test('should display segments page shell and table', async ({ page }) => {
    await page.goto('/sabsms/segments');
    
    // Check headings
    await expect(page.getByRole('heading', { name: 'Segments' }).first()).toBeVisible();
    await expect(page.getByText('Audience predicates power campaigns')).toBeVisible();

    // Verify "New segment" or similar create action if it exists. Actually we'll just check if the table/shell is there
    await expect(page.locator('table')).toBeVisible();
    
    // Verify some column headers if possible (e.g. Name, Kind, Count, Last Calculated)
    await expect(page.getByRole('columnheader', { name: 'Name' }).first()).toBeVisible();
  });
});
