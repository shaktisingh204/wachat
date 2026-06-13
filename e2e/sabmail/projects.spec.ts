// Requires the dev server + a seeded authed session (see e2e/sabsms harness); these are smoke specs.
import { test, expect } from '@playwright/test';

test.describe('SabMail Projects Picker', () => {
  test('should render the projects picker shell', async ({ page }) => {
    await page.goto('/sabmail/projects');

    // Heading + description for the isolated-workspace picker.
    await expect(page.getByRole('heading', { name: 'SabMail projects' }).first()).toBeVisible();
    await expect(page.getByText(/isolated email workspace/i)).toBeVisible();

    // Primary action to create a new project.
    await expect(page.getByRole('button', { name: /New project/i }).first()).toBeVisible();
  });

  test('create-project flow opens the dialog and reaches setup', async ({ page }) => {
    await page.goto('/sabmail/projects');

    // Open the "New project" dialog (also exposed via the empty-state "Create project").
    const newBtn = page.getByRole('button', { name: /New project|Create project/i }).first();
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    // The create dialog surfaces with a name field and a create-and-setup action.
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('New SabMail project')).toBeVisible();

    const nameInput = page.getByPlaceholder(/Support — acme.com/i);
    await expect(nameInput).toBeVisible();
    await nameInput.fill(`E2E Smoke ${Date.now()}`);

    const createBtn = page.getByRole('button', { name: /Create & set up/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // A brand-new project always lands on the mandatory setup wizard.
    await expect(page).toHaveURL(/\/sabmail\/setup/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /Set up SabMail/i }).first()).toBeVisible();
  });
});
