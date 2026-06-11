/**
 * Playwright global setup — seeds the e2e fixture user in Mongo and
 * writes an authenticated storageState (the app's `session` JWT cookie)
 * to e2e/.auth/sabflow.json. The `sabflow` project in playwright.config.ts
 * points its `storageState` here, so every e2e/sabflow spec starts
 * logged in.
 *
 * Mongo-unreachable runs (the macOS local-network EADDRNOTAVAIL flake —
 * see tests/README.md) do NOT abort the whole Playwright run: the cookie
 * is minted anyway against the deterministic TEST_USER_ID, which keeps
 * working as long as some earlier run managed to seed the user. The
 * sabsms project never depended on auth and is unaffected either way.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  ensureTestUser,
  mintSessionCookie,
  repoRoot,
} from './helpers/session';

export const STORAGE_STATE_PATH = path.join(repoRoot(), 'e2e', '.auth', 'sabflow.json');

export default async function globalSetup(): Promise<void> {
  try {
    await ensureTestUser();
    console.log('[e2e/global-setup] fixture user upserted in Mongo');
  } catch (err) {
    console.warn(
      '[e2e/global-setup] WARNING: could not reach Mongo to upsert the fixture user — ' +
        'minting the session cookie anyway (deterministic user id; works if a previous ' +
        'run seeded the user). On macOS this is usually the local-network permission ' +
        'flake (EADDRNOTAVAIL on localhost:27017) — see tests/README.md.\n  cause:',
      err instanceof Error ? err.message : err,
    );
  }

  const cookie = await mintSessionCookie();
  const storageState = { cookies: [cookie], origins: [] as never[] };

  mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });
  writeFileSync(STORAGE_STATE_PATH, JSON.stringify(storageState, null, 2));
  console.log(`[e2e/global-setup] storage state written to ${STORAGE_STATE_PATH}`);
}
