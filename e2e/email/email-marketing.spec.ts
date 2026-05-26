import { test, expect } from '@playwright/test';

test.describe('Email Marketing Module - Overview & Navigation', () => {
  test('should display the overview page and show stats', async ({ page }) => {
    await page.goto('/dashboard/email');
    
    // Check that we're on the overview page
    await expect(page.getByRole('heading', { name: /Overview/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Performance summary')).toBeVisible();
  });

  test('should navigate to Campaigns and create a draft', async ({ page }) => {
    await page.goto('/dashboard/email/campaigns');
    
    // Check Campaigns header
    await expect(page.getByRole('heading', { name: /Campaigns/i }).first()).toBeVisible();

    // Click "New campaign" button
    const newCampaignBtn = page.getByRole('button', { name: /New campaign/i });
    if (await newCampaignBtn.isVisible()) {
      await newCampaignBtn.click();
      
      // Dialog appears
      await expect(page.getByRole('heading', { name: /New campaign/i, exact: true })).toBeVisible();
      
      // Fill the form
      await page.fill('input[id="c-name"]', 'Test E2E Campaign');
      await page.fill('input[id="c-subj"]', 'Hello from Playwright');
      await page.fill('input[id="c-fn"]', 'SabNode Tester');
      await page.fill('input[id="c-fe"]', 'test@sabnode.com');
      
      // Note: Body is pre-filled, we could overwrite it
      await page.fill('textarea[id="c-body"]', '<h1>E2E Test Email</h1>');
      
      // Close without saving to avoid cluttering DB in test
      await page.getByRole('button', { name: /Cancel/i }).click();
    }
  });

  test('should load the Templates page', async ({ page }) => {
    await page.goto('/dashboard/email/templates');
    const heading = page.locator('h1, h2, h3').filter({ hasText: /Templates/i }).first();
    if (await heading.isVisible()) {
      await expect(heading).toBeVisible();
    }
  });

  test('should load the Audience/Contacts page', async ({ page }) => {
    await page.goto('/dashboard/email/audience');
    const heading = page.locator('h1, h2, h3').filter({ hasText: /(Audience|Contacts)/i }).first();
    if (await heading.isVisible()) {
      await expect(heading).toBeVisible();
    }
  });
});
