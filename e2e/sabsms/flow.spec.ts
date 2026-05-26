import { test, expect } from '@playwright/test';

test.describe('SabFlow Builder', () => {
  test('should display the flow builder interface with core elements', async ({ page }) => {
    await page.goto('/sabsms/flow');
    
    // Check flow header
    await expect(page.getByText('Onboarding Welcome Series')).toBeVisible();
    await expect(page.getByText('Live')).toBeVisible();
    
    // Check tabs
    await expect(page.getByRole('button', { name: 'Build' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Test', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analytics' })).toBeVisible();
    
    // Check actions
    await expect(page.getByRole('button', { name: 'Test Flow' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Deploy' })).toBeVisible();
  });

  test('should display node palette categories and nodes', async ({ page }) => {
    await page.goto('/sabsms/flow');
    
    // Categories
    await expect(page.getByText('Triggers', { exact: true })).toBeVisible();
    await expect(page.getByText('Actions', { exact: true })).toBeVisible();
    await expect(page.getByText('Logic', { exact: true })).toBeVisible();
    
    // Nodes in palette (DraggableNodes)
    await expect(page.getByRole('heading', { name: 'Webhook Received' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Send SMS' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'If / Else' })).toBeVisible();
  });

  test('should display canvas nodes and switch properties on click', async ({ page }) => {
    await page.goto('/sabsms/flow');
    
    // Canvas nodes
    await expect(page.getByRole('heading', { name: 'App Event' }).nth(1)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Delay' }).nth(1)).toBeVisible();
    
    // Default properties selection (node-sms is selected by default in the state)
    // Wait for the default state to render in properties sidebar
    const propsSidebar = page.locator('aside');
    await expect(propsSidebar.getByRole('heading', { name: 'Send SMS' })).toBeVisible();
    
    // Check some content from the SMS properties
    await expect(propsSidebar.getByDisplayValue('Welcome Offer')).toBeVisible();
    await expect(propsSidebar.getByText('Personalized variables may increase SMS length')).toBeVisible();
    
    // Click on "Send Email" node to change properties
    const emailNode = page.locator('div').filter({ hasText: /^Send EmailNewsletter #1$/ }).first();
    await emailNode.click();
    
    // Check properties updated
    await expect(propsSidebar.getByRole('heading', { name: 'Send Email' })).toBeVisible();
    await expect(propsSidebar.getByDisplayValue('Newsletter #1')).toBeVisible();
  });
});
