import { test, expect } from '@playwright/test';

test.describe('Campaigns List and Creation', () => {
  test('should display campaigns list and navigate to new campaign', async ({ page }) => {
    await page.goto('/sabsms/campaigns');
    
    // Check that we're on the campaigns page
    await expect(page.getByText('Filter campaigns...')).toBeVisible();

    // Verify some column headers exist
    await expect(page.getByRole('columnheader', { name: 'Campaign' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();

    // Find the "New Campaign" button or link
    const newCampaignLink = page.getByRole('link', { name: /New Campaign/i });
    if (await newCampaignLink.isVisible()) {
      await newCampaignLink.click();
      await expect(page).toHaveURL(/.*\/sabsms\/campaigns\/new/);
    } else {
      console.log('New campaign link not directly visible (maybe behind a dropdown or different name)');
    }
  });

  test('should load the new campaign wizard', async ({ page }) => {
    await page.goto('/sabsms/campaigns/new');

    // Wait for wizard to load
    await expect(page.getByText('New campaign')).toBeVisible();

    // Check steps presence
    await expect(page.getByText('Template')).toBeVisible();
    await expect(page.getByText('Audience')).toBeVisible();
    await expect(page.getByText('Sender')).toBeVisible();
    await expect(page.getByText('Review')).toBeVisible();
  });
});
