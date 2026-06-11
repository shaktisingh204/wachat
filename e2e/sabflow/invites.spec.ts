/**
 * SabFlow — workspace invite inbox.
 *
 * Seeds (via e2e/helpers/seed.ts) a workspace owned by the fixture user and
 * an invite addressed to the fixture user's own email — GET
 * /api/sabflow/workspaces/invites lists incoming purely by email match, so
 * the invite shows up in the "Pending invites" section of
 * /dashboard/sabflow/invites (invites-client.tsx).
 *
 * The test asserts the incoming card renders (workspace name + role), then
 * declines it (DELETE /api/sabflow/workspaces/[wsId]/invites/[inviteId]) and
 * checks the "Invite declined." toast + the card disappearing.
 *
 * Requires Mongo from this process for seeding — skips on the macOS
 * local-network flake (see tests/README.md).
 */

import { test, expect } from '@playwright/test';
import type { Db, MongoClient } from 'mongodb';
import { connectMongo, ensureTestUser, TEST_USER_EMAIL } from '../helpers/session';
import { cleanup, createWorkspace, createWorkspaceInvite } from '../helpers/seed';

test.setTimeout(120_000);

let client: MongoClient | null = null;
let db: Db | null = null;
let mongoError = '';
let workspaceName = '';

test.beforeAll(async () => {
  try {
    const conn = await connectMongo(3000);
    client = conn.client;
    db = conn.db;
    await ensureTestUser(db);
    const ws = await createWorkspace(db);
    workspaceName = ws.name;
    await createWorkspaceInvite(db, {
      workspaceId: ws.workspaceId,
      email: TEST_USER_EMAIL,
      role: 'editor',
    });
  } catch (err) {
    mongoError = err instanceof Error ? err.message : String(err);
  }
});

test.afterAll(async () => {
  if (db) await cleanup(db);
  if (client) await client.close();
});

test('incoming invite shows in the inbox and disappears on decline', async ({
  page,
}) => {
  test.skip(
    !db,
    `Mongo not reachable from this process (${mongoError}) — macOS local-network flake, see tests/README.md`,
  );

  await page.goto('/dashboard/sabflow/invites', { timeout: 90_000 });
  await expect(
    page.getByRole('heading', { level: 1, name: 'Invites' }),
  ).toBeVisible();

  // Incoming section: card with "<workspace> invited you as <role>".
  const inbox = page.getByRole('region', { name: 'Pending invites for you' });
  const card = inbox.locator('.u-card').filter({ hasText: workspaceName }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText('invited you as')).toBeVisible();
  await expect(card.getByText('editor', { exact: true })).toBeVisible();

  // Decline → toast + card gone.
  await card.getByRole('button', { name: 'Decline' }).click();
  await expect(page.getByText('Invite declined.')).toBeVisible({
    timeout: 15_000,
  });
  await expect(card).toBeHidden();
});
