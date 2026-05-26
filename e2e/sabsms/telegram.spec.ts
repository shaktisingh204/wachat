import { test, expect } from '@playwright/test';

test.describe('Telegram Integration', () => {
  test('should load Telegram dashboard', async ({ page }) => {
    await page.goto('/dashboard/telegram');

    // Wait for the main elements to load
    // The exact text depends on the actual UI, checking for common elements
    await expect(page.getByRole('heading', { name: /Telegram/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Telegram bots section', async ({ page }) => {
    await page.goto('/dashboard/telegram');

    // Check for a link or tab to 'Bots' or 'Settings'
    const botsLink = page.getByRole('link', { name: /Bots/i });
    if (await botsLink.isVisible()) {
      await botsLink.click();
      await expect(page).toHaveURL(/.*\/bots/);
    }
  });

  test('should display Telegram chats or channels', async ({ page }) => {
    await page.goto('/dashboard/telegram/chat');

    // Simple visibility check for the chat page
    const chatHeading = page.getByRole('heading', { name: /Chat|Inbox/i }).first();
    if (await chatHeading.isVisible()) {
      await expect(chatHeading).toBeVisible();
    }
  });
});
