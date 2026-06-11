/**
 * SabFlow — smoke render of every sidebar route.
 *
 * One test per route in the SabFlow module sidebar (see the `sabflow` entry
 * in src/components/sabcrm/20ui/composites/shell/app-sidebars.tsx — 18 links
 * across 5 groups). Each test asserts:
 *
 *   - navigation succeeds (HTTP < 400, no redirect to /login),
 *   - the shell's <main> landmark renders,
 *   - no error boundary / Next error page took over
 *     ("Something went wrong!" comes from src/app/dashboard/sabflow/error.tsx),
 *   - where the page passes a `title` to SabflowPage, the h1 is visible
 *     (PageTitle renders an <h1> — src/components/sabcrm/20ui/pageheader.tsx).
 *
 * Plus one dark-mode pass: localStorage `sabnode-theme=dark` (the key used
 * by app-theme.tsx) is set before load, then the spec asserts `html.dark`
 * and that the page background is not white.
 *
 * Auth comes from the storageState minted in e2e/global-setup.ts. If Mongo
 * was never reachable for any setup run the fixture user does not exist and
 * the app redirects to /login — the navigation assertion below surfaces that
 * with a clear message instead of 18 confusing failures.
 */

import { test, expect, type Page } from '@playwright/test';

// Dev-mode route compiles can be slow on first hit.
test.setTimeout(120_000);

interface RouteSpec {
  path: string;
  /** Visible <h1> text when the page sets a SabflowPage title. */
  h1?: string;
}

const ROUTES: RouteSpec[] = [
  { path: '/dashboard/sabflow' }, // Overview (variant="app", no header)
  { path: '/dashboard/sabflow/flow-builder', h1: 'SabFlow' },
  { path: '/dashboard/sabflow/folders', h1: 'Folders' },
  { path: '/dashboard/sabflow/marketplace', h1: 'Template Marketplace' },
  { path: '/dashboard/sabflow/import' },
  { path: '/dashboard/sabflow/executions', h1: 'Executions' },
  { path: '/dashboard/sabflow/logs', h1: 'System Logs' },
  { path: '/dashboard/sabflow/links' },
  { path: '/dashboard/sabflow/health' },
  { path: '/dashboard/sabflow/connections', h1: 'Connections' },
  { path: '/dashboard/sabflow/api-keys' },
  { path: '/dashboard/sabflow/env-vars', h1: 'Environment Variables' },
  { path: '/dashboard/sabflow/workspaces' },
  { path: '/dashboard/sabflow/invites', h1: 'Invites' },
  { path: '/dashboard/sabflow/usage' },
  { path: '/dashboard/sabflow/audit', h1: 'Audit Log' },
  { path: '/dashboard/sabflow/docs' },
  { path: '/dashboard/sabflow/settings' },
];

async function expectPageRendered(page: Page, path: string): Promise<void> {
  // Redirect to /login means the storageState cookie did not resolve to a
  // user (fixture user never seeded — see the Mongo flake note in
  // tests/README.md). Fail loudly with the cause.
  expect(
    new URL(page.url()).pathname,
    `expected to stay on ${path} — a redirect to /login means the e2e fixture ` +
      'user is not in Mongo (re-run once Mongo is reachable so global-setup can seed it)',
  ).not.toBe('/login');

  await expect(page.locator('main').first()).toBeVisible();

  // Error boundary (src/app/dashboard/sabflow/error.tsx) / prod client crash
  // marker / Next 404 page.
  await expect(page.getByText('Something went wrong!')).toHaveCount(0);
  await expect(
    page.getByText('Application error: a client-side exception'),
  ).toHaveCount(0);
  await expect(page.getByText('This page could not be found')).toHaveCount(0);
}

for (const route of ROUTES) {
  test(`renders ${route.path}`, async ({ page }) => {
    const response = await page.goto(route.path, { timeout: 90_000 });
    expect(response, 'expected a navigation response').not.toBeNull();
    expect(response!.status(), `GET ${route.path}`).toBeLessThan(400);

    await expectPageRendered(page, route.path);

    if (route.h1) {
      await expect(
        page.getByRole('heading', { level: 1, name: route.h1 }),
      ).toBeVisible();
    }
  });
}

test('dark mode: sabnode-theme=dark applies html.dark and a non-white background', async ({
  page,
}) => {
  // app-theme.tsx reads localStorage 'sabnode-theme' and toggles the 'dark'
  // class on <html>; seed the preference before any script runs.
  await page.addInitScript(() => {
    window.localStorage.setItem('sabnode-theme', 'dark');
  });

  await page.goto('/dashboard/sabflow/env-vars', { timeout: 90_000 });
  await expectPageRendered(page, '/dashboard/sabflow/env-vars');

  await expect(page.locator('html')).toHaveClass(/\bdark\b/, {
    timeout: 15_000,
  });

  // Walk body → main → html until we find a painted background, then assert
  // it is not white.
  const bg = await page.evaluate(() => {
    const painted = (el: Element | null): string | null => {
      if (!el) return null;
      const c = getComputedStyle(el).backgroundColor;
      return c === 'transparent' || c === 'rgba(0, 0, 0, 0)' ? null : c;
    };
    return (
      painted(document.body) ??
      painted(document.querySelector('main')) ??
      painted(document.documentElement) ??
      'rgba(0, 0, 0, 0)'
    );
  });

  expect(bg, 'dark theme must not paint a white background').not.toBe(
    'rgb(255, 255, 255)',
  );
});
