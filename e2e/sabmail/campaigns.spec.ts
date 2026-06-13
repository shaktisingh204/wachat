// Requires the dev server + a seeded authed session (see e2e/sabsms harness); these are smoke specs.
import { test, expect } from '@playwright/test';

test.describe('SabMail Campaigns', () => {
  test('campaigns surface renders heading and broadcasts section', async ({ page }) => {
    await page.goto('/sabmail/campaigns');

    // With an active project the Campaigns page renders; otherwise the page
    // redirects to the projects picker. Either heading is an acceptable smoke.
    const campaignsHeading = page.getByRole('heading', { name: 'Campaigns' }).first();
    const projectsHeading = page.getByRole('heading', { name: 'SabMail projects' }).first();
    await expect(campaignsHeading.or(projectsHeading)).toBeVisible({ timeout: 15000 });

    if (await campaignsHeading.isVisible().catch(() => false)) {
      // The broadcasts card or its empty state should be present.
      const broadcasts = page.getByText('Broadcasts').first();
      const emptyState = page.getByText(/No campaigns yet/i);
      await expect(broadcasts.or(emptyState)).toBeVisible();

      // The primary "New campaign" action exists (possibly disabled if no mailbox).
      await expect(page.getByRole('button', { name: /New campaign/i }).first()).toBeVisible();
    }
  });
});
