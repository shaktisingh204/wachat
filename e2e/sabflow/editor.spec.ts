/**
 * SabFlow — flow editor (canvas + palette + node creator + settings panel).
 *
 * Seeds a flow directly in Mongo (e2e/helpers/seed.ts createScheduledFlow —
 * the schedule event keeps the "What triggers this workflow?" rail from
 * auto-opening over the canvas) and drives the editor at
 * /dashboard/sabflow/flow-builder/[flowId]:
 *
 *   - canvas mounts ([data-testid="sabflow-canvas"], Canvas.tsx),
 *   - palette (BlocksSideBar.tsx) search finds a known app preset and the
 *     Apps footer ([data-testid="sabflow-apps-count"]) reports ≥ 400 apps,
 *   - click-to-add through the NodeCreator (Tab opens it — see
 *     useCanvasKeyboard.ts; [data-testid="sabflow-node-creator"]); the picked
 *     preset lands on the canvas as a forge_app_preset node,
 *   - dirty dot (aria-label "Unsaved changes", FlowEditorHeader.tsx) shows
 *     after the edit; the autosave indicator ("Saving..." / "Saved hh:mm")
 *     follows within AUTOSAVE_DELAY_MS (3s) + save time,
 *   - double-clicking the node opens the settings panel with the preset's
 *     brand header and an "Action" select (AppPresetSettings.tsx).
 *
 * Requires Mongo from this process for seeding — skips with a clear message
 * on the macOS local-network flake (see tests/README.md).
 */

import { test, expect } from '@playwright/test';
import type { Db, MongoClient } from 'mongodb';
import { connectMongo, ensureTestUser } from '../helpers/session';
import { cleanup, createScheduledFlow } from '../helpers/seed';

test.setTimeout(180_000);
test.describe.configure({ mode: 'serial' });

let client: MongoClient | null = null;
let db: Db | null = null;
let mongoError = '';
let flowId = '';

test.beforeAll(async () => {
  try {
    const conn = await connectMongo(3000);
    client = conn.client;
    db = conn.db;
    await ensureTestUser(db);
    ({ flowId } = await createScheduledFlow(db));
  } catch (err) {
    mongoError = err instanceof Error ? err.message : String(err);
  }
});

test.afterAll(async () => {
  if (db) await cleanup(db);
  if (client) await client.close();
});

test('editor: canvas, palette search, ≥400 apps, click-to-add, settings panel, autosave', async ({
  page,
}) => {
  test.skip(
    !db,
    `Mongo not reachable from this process (${mongoError}) — macOS local-network flake, see tests/README.md`,
  );

  /* ── Pick a known preset from the live catalog ─────────────────────── */
  const presetsRes = await page.request.get('/api/sabflow/app-presets');
  expect(presetsRes.ok(), 'GET /api/sabflow/app-presets').toBeTruthy();
  const { presets } = (await presetsRes.json()) as {
    presets: Array<{ id: string; name: string }>;
  };
  expect(presets.length).toBeGreaterThan(0);
  const preset =
    presets.find((p) => p.id === 'adyen') ??
    presets.find((p) => p.id === 'airtable') ??
    presets[0];

  /* ── Editor loads ──────────────────────────────────────────────────── */
  await page.goto(`/dashboard/sabflow/flow-builder/${flowId}`, {
    timeout: 120_000,
  });
  const canvas = page.getByTestId('sabflow-canvas');
  await expect(canvas).toBeVisible({ timeout: 60_000 });

  /* ── Palette search + Apps footer count ────────────────────────────── */
  const paletteSearch = page.getByLabel('Search blocks and apps');
  await expect(paletteSearch).toBeVisible();

  // Catalog loads async — the footer only renders once loading completes.
  const appsCount = page.getByTestId('sabflow-apps-count');
  await expect(appsCount).toBeVisible({ timeout: 60_000 });
  const countText = (await appsCount.textContent()) ?? '';
  const match = countText.match(/(\d+)\s+apps/);
  expect(match, `apps footer text was "${countText}"`).not.toBeNull();
  expect(Number(match![1])).toBeGreaterThanOrEqual(400);

  await paletteSearch.fill(preset.name);
  // Search force-expands app categories; the preset's card shows up.
  await expect(
    page.getByText(preset.name, { exact: true }).first(),
  ).toBeVisible({ timeout: 30_000 });
  await paletteSearch.fill('');

  /* ── Click-to-add via the NodeCreator (Tab shortcut) ───────────────── */
  // Blur the search input first — canvas shortcuts are ignored while an
  // input has focus (shouldIgnoreCanvasShortcut).
  await canvas.click({ position: { x: 700, y: 450 } });
  await page.keyboard.press('Tab');

  const creator = page.getByTestId('sabflow-node-creator');
  await expect(creator).toBeVisible();
  await creator.getByPlaceholder('Search nodes & apps').fill(preset.name);
  await creator
    .locator('[role="option"]')
    .filter({ hasText: preset.name })
    .first()
    .click();
  await expect(creator).toBeHidden();

  // Node landed on the canvas (forge_app_preset renders options.__label).
  const node = page
    .locator('.react-flow__node')
    .filter({ hasText: preset.name })
    .first();
  await expect(node).toBeVisible({ timeout: 15_000 });

  /* ── Dirty dot, then autosave indicator ────────────────────────────── */
  await expect(page.getByLabel('Unsaved changes')).toBeVisible();
  // AUTOSAVE_DELAY_MS = 3000 in EditorPage.tsx; "Saving..." can flash by too
  // fast to catch reliably, so accept either phase of the indicator.
  await expect(
    page.getByText(/^(Saving\.\.\.|Saved\s)/).first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/^Saved\s/).first()).toBeVisible({
    timeout: 30_000,
  });

  /* ── Settings panel (double-click opens it) ────────────────────────── */
  await node.dblclick();
  // AppPresetSettings → PresetEditor: locked brand header + Action select.
  await expect(
    page.getByRole('button', { name: 'Change' }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel('Action').first()).toBeVisible();
});
