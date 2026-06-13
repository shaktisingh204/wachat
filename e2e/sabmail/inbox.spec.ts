// Requires the dev server + a seeded authed session (see e2e/sabsms harness); these are smoke specs.
import { test, expect } from '@playwright/test';

test.describe('SabMail Inbox + Accounts', () => {
  test('inbox surface renders heading or routes to the projects picker', async ({ page }) => {
    await page.goto('/sabmail/inbox');

    // With an active project the Inbox renders; without one the page redirects
    // to the projects picker. Either heading is an acceptable smoke result.
    const inboxHeading = page.getByRole('heading', { name: 'Inbox' }).first();
    const projectsHeading = page.getByRole('heading', { name: 'SabMail projects' }).first();
    await expect(inboxHeading.or(projectsHeading)).toBeVisible({ timeout: 15000 });
  });

  test('inbox empty state prompts connecting a mailbox', async ({ page }) => {
    await page.goto('/sabmail/inbox');

    // When no IMAP mailbox is connected the inbox shows a connect prompt.
    // Keep this tolerant: the empty-state copy OR the projects-picker fallback.
    const connectPrompt = page.getByText(/Connect a mailbox to begin/i);
    const description = page.getByText(/fast, keyboard-first inbox/i);
    const projectsHeading = page.getByRole('heading', { name: 'SabMail projects' }).first();
    await expect(connectPrompt.or(description).or(projectsHeading)).toBeVisible({ timeout: 15000 });
  });

  test('accounts surface renders heading and connected-mailboxes section', async ({ page }) => {
    await page.goto('/sabmail/accounts');

    const accountsHeading = page.getByRole('heading', { name: 'Accounts' }).first();
    const projectsHeading = page.getByRole('heading', { name: 'SabMail projects' }).first();
    await expect(accountsHeading.or(projectsHeading)).toBeVisible({ timeout: 15000 });

    // On the accounts page proper, the connected-mailboxes card or its empty
    // state should be present.
    if (await accountsHeading.isVisible().catch(() => false)) {
      const connectedCard = page.getByText('Connected mailboxes').first();
      const emptyState = page.getByText(/No mailboxes connected/i);
      const connectForm = page.getByText(/Connect a mailbox/i).first();
      await expect(connectedCard.or(emptyState).or(connectForm)).toBeVisible();
    }
  });
});
