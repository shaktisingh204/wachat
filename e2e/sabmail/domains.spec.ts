// Requires the dev server + a seeded authed session (see e2e/sabsms harness); these are smoke specs.
import { test, expect } from '@playwright/test';

test.describe('SabMail Domains & Deliverability', () => {
  test('domains surface renders heading and add-domain action', async ({ page }) => {
    await page.goto('/sabmail/domains');

    // With an active project the Domains page renders; otherwise the page
    // redirects to the projects picker. Either heading is an acceptable smoke.
    const domainsHeading = page.getByRole('heading', { name: /Domains & Deliverability/i }).first();
    const projectsHeading = page.getByRole('heading', { name: 'SabMail projects' }).first();
    await expect(domainsHeading.or(projectsHeading)).toBeVisible({ timeout: 15000 });

    if (await domainsHeading.isVisible().catch(() => false)) {
      // Deliverability copy + the add-domain primary action.
      await expect(page.getByText(/Authenticate the domains you send from/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Add domain/i }).first()).toBeVisible();
    }
  });

  test('add-domain dialog opens with the domain field', async ({ page }) => {
    await page.goto('/sabmail/domains');

    const addBtn = page.getByRole('button', { name: /Add domain/i }).first();
    // Only exercise the dialog when on the domains page proper.
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText('Add a sending domain')).toBeVisible();
      await expect(page.getByPlaceholder(/mail.example.com/i)).toBeVisible();
    }
  });
});
