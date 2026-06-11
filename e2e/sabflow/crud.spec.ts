/**
 * SabFlow — CRUD flows through the real UI.
 *
 *   1. Env var   (/dashboard/sabflow/env-vars, env-vars-client.tsx):
 *      add via the modal → appears in the table → delete → gone. Toasts
 *      ("Saved KEY" / "Deleted KEY") assert the success paths fired.
 *   2. Folder    (/dashboard/sabflow/folders, folders-client.tsx):
 *      create → card visible → delete → card gone.
 *   3. Connection (/dashboard/sabflow/connections, connections-client.tsx —
 *      the credentials manager): create a `custom` credential with one
 *      key/value pair → card appears → delete via the card menu → gone.
 *      Credentials are intentionally created through the UI/API only
 *      (values are encrypted at rest — see e2e/helpers/seed.ts header).
 *
 * Mongo is used for after-the-fact cleanup only; when it is unreachable from
 * this process (macOS local-network flake, see tests/README.md) the tests
 * still run — every record they create is also deleted through the UI.
 */

import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import type { Db, MongoClient } from 'mongodb';
import { connectMongo, TEST_USER_ID } from '../helpers/session';
import { cleanup } from '../helpers/seed';

test.setTimeout(120_000);
test.describe.configure({ mode: 'serial' });

let client: MongoClient | null = null;
let db: Db | null = null;

test.beforeAll(async () => {
  try {
    const conn = await connectMongo(3000);
    client = conn.client;
    db = conn.db;
  } catch {
    // Cleanup becomes best-effort; the tests delete their own records via UI.
  }
});

test.afterAll(async () => {
  if (db) {
    await cleanup(db);
    // Credentials are not covered by seed.cleanup() (they are never seeded
    // directly) — sweep the ones this suite created through the UI.
    await db
      .collection('sabflow_credentials')
      .deleteMany({ workspaceId: TEST_USER_ID, name: /^e2e-/ });
  }
  if (client) await client.close();
});

test('env var: add → listed → delete → gone', async ({ page }) => {
  const key = `E2E_VAR_${randomBytes(3).toString('hex').toUpperCase()}`;

  await page.goto('/dashboard/sabflow/env-vars', { timeout: 90_000 });
  await expect(
    page.getByRole('heading', { level: 1, name: 'Environment Variables' }),
  ).toBeVisible();

  // Add (header button; an empty list also offers "Add your first variable").
  await page.getByRole('button', { name: 'Add variable' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('MY_API_KEY').fill(key);
  await dialog
    .getByPlaceholder('https://example.com/webhook')
    .fill('e2e-value');
  await dialog.getByRole('button', { name: 'Add variable' }).click();

  // Toast + table row.
  await expect(page.getByText(`Saved ${key}`)).toBeVisible();
  await expect(page.getByText(key, { exact: true })).toBeVisible();

  // Delete.
  await page.getByRole('button', { name: `Delete ${key}` }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm.getByText(`$env.${key}`)).toBeVisible();
  await confirm.getByRole('button', { name: 'Delete', exact: true }).click();

  await expect(page.getByText(`Deleted ${key}`)).toBeVisible();
  await expect(page.getByText(key, { exact: true })).toHaveCount(0);
});

test('folder: create → visible → delete → gone', async ({ page }) => {
  const name = `e2e-folder-${randomBytes(3).toString('hex')}`;

  await page.goto('/dashboard/sabflow/folders', { timeout: 90_000 });
  await expect(
    page.getByRole('heading', { level: 1, name: 'Folders' }),
  ).toBeVisible();

  // Create ("Create folder" header button; empty state offers
  // "Create your first folder").
  await page.getByRole('button', { name: /Create (your first )?folder/ }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('e.g. Customer onboarding').fill(name);
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();

  await expect(page.getByText('Folder created')).toBeVisible();
  const card = page.locator('.u-card').filter({ hasText: name }).first();
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  // Delete — the per-card icon button is hover-revealed on desktop.
  await page.getByText(name, { exact: true }).hover();
  // Scope to the row/card so we hit ITS delete button, not another card's.
  await card.getByRole('button', { name: 'Delete folder' }).click();

  const confirm = page.getByRole('dialog');
  await expect(confirm.getByText(`“${name}”`)).toBeVisible();
  await confirm.getByRole('button', { name: 'Delete folder' }).click();

  await expect(page.getByText('Folder deleted')).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
});

test('connection: create custom credential → card appears → delete → gone', async ({
  page,
}) => {
  const name = `e2e-conn-${randomBytes(3).toString('hex')}`;

  await page.goto('/dashboard/sabflow/connections', { timeout: 90_000 });
  await expect(
    page.getByRole('heading', { level: 1, name: 'Connections' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'New connection' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByPlaceholder('e.g. Production OpenAI').fill(name);

  // Type combobox (20ui Combobox: input role=combobox, panel role=listbox).
  const typeBox = dialog.getByRole('combobox');
  await typeBox.click();
  await typeBox.fill('custom');
  // 'custom' matches both "Custom" (Generic) and "Customer.io" — pick the
  // generic one by its category description.
  await page
    .getByRole('option')
    .filter({ hasText: 'Generic' })
    .filter({ hasText: 'Custom' })
    .first()
    .click();

  // Custom credentials take free-form key/value pairs.
  await dialog.getByLabel('Custom field 1 key').fill('apiKey');
  await dialog.getByLabel('Custom field 1 value').fill('e2e-secret-value');

  await dialog.getByRole('button', { name: 'Create connection' }).click();

  await expect(page.getByText(/^Connected /)).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name })).toBeVisible();

  // Delete via the card's actions menu.
  await page.getByRole('button', { name: `Actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();

  const confirm = page.getByRole('dialog');
  await expect(confirm.getByText(`Delete “${name}”?`)).toBeVisible();
  await confirm.getByRole('button', { name: 'Delete connection' }).click();

  await expect(page.getByText(`Deleted "${name}".`)).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name })).toHaveCount(0);
});
