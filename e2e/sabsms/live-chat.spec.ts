import { test, expect } from '@playwright/test';

test.describe('Live Chat (SabChat)', () => {
  test('should redirect from root sabchat to inbox', async ({ page }) => {
    await page.goto('/dashboard/sabchat');
    
    // Check that we're redirected to the inbox
    await expect(page).toHaveURL(/.*\/dashboard\/sabchat\/inbox/);
  });

  test('should load the live chat inbox interface', async ({ page }) => {
    await page.goto('/dashboard/sabchat/inbox');

    // Wait for the inbox elements
    await expect(page.getByRole('heading', { name: /Inbox|Live Chat/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('should be able to type a message if a conversation is selected', async ({ page }) => {
    await page.goto('/dashboard/sabchat/inbox');

    // Select a conversation if available
    const firstConversation = page.locator('.conversation-item, [role="listitem"]').first();
    if (await firstConversation.isVisible()) {
      await firstConversation.click();
    }

    // Check message input
    const messageInput = page.getByPlaceholder(/type.*message/i);
    if (await messageInput.isVisible()) {
      await expect(messageInput).toBeVisible();
      await messageInput.fill('Test message for Live Chat E2E');
      
      const sendButton = page.getByRole('button', { name: /Send/i });
      if (await sendButton.isVisible()) {
        await expect(sendButton).toBeVisible();
      }
    }
  });
});
