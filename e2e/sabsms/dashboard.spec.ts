import { test, expect } from '@playwright/test';

test.describe('SabSMS Dashboard Overview', () => {
  test('should load the dashboard and display metrics', async ({ page }) => {
    await page.goto('/sabsms');
    
    // Check page title
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByText('SabSMS Dashboard: High-throughput')).toBeVisible();

    // Check for metrics
    await expect(page.getByText('Total Sent')).toBeVisible();
    await expect(page.getByText('Delivery Rate')).toBeVisible();
    await expect(page.getByText('Active Campaigns').first()).toBeVisible();

    // Check for primary action
    const newCampaignBtn = page.getByRole('link', { name: 'New Campaign' });
    await expect(newCampaignBtn).toBeVisible();
  });

  test('should navigate to View all campaigns', async ({ page }) => {
    await page.goto('/sabsms');

    // Click "View all campaigns →"
    const viewAllBtn = page.getByRole('link', { name: /View all campaigns/i });
    await expect(viewAllBtn).toBeVisible();
    
    await viewAllBtn.click();
    await expect(page).toHaveURL(/.*\/sabsms\/campaigns/);
  });
});
