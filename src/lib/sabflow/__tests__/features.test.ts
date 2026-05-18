/**
 * Unit tests for src/lib/sabflow/features.ts
 *
 * Uses Node's built-in `node:test` + `tsx` (same as the rest of this dir).
 * Run with:
 *
 *   npx tsx --test src/lib/sabflow/__tests__/features.test.ts
 *
 * Each test re-requires the module after manipulating `process.env` so that
 * the module-level constants are re-evaluated from scratch.
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Absolute path to the module under test.
const FEATURES_MODULE = path.resolve(__dirname, '../features.ts');

/**
 * Re-import `features.ts` in a fresh module context.
 *
 * `tsx`'s `--test` runner uses ESM; we use a dynamic `import()` with a
 * cache-busting query string so each call gets a new module evaluation and
 * picks up the current `process.env` snapshot.
 */
async function loadFeatures(tick: number) {
  const url = `${FEATURES_MODULE}?tick=${tick}`;
  const mod = await import(url) as {
    SABFLOW_COLLAB_ENABLED: boolean;
    SABFLOW_PLAYBACK_ENABLED: boolean;
    SABFLOW_MARKETPLACE_ENABLED: boolean;
  };
  return mod;
}

// ---------------------------------------------------------------------------
// SABFLOW_COLLAB_ENABLED
// ---------------------------------------------------------------------------

describe('SABFLOW_COLLAB_ENABLED', () => {
  let tick = 0;
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED;
    tick++;
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED = saved;
    }
  });

  it('is false when the env var is unset', async () => {
    delete process.env.NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED;
    const { SABFLOW_COLLAB_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_COLLAB_ENABLED, false);
  });

  it('is false when the env var is an empty string', async () => {
    process.env.NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED = '';
    const { SABFLOW_COLLAB_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_COLLAB_ENABLED, false);
  });

  it('is false when the env var is "0"', async () => {
    process.env.NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED = '0';
    const { SABFLOW_COLLAB_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_COLLAB_ENABLED, false);
  });

  it('is false when the env var is "false"', async () => {
    process.env.NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED = 'false';
    const { SABFLOW_COLLAB_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_COLLAB_ENABLED, false);
  });

  it('is true when the env var is "true"', async () => {
    process.env.NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED = 'true';
    const { SABFLOW_COLLAB_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_COLLAB_ENABLED, true);
  });

  it('is true when the env var is "1"', async () => {
    process.env.NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED = '1';
    const { SABFLOW_COLLAB_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_COLLAB_ENABLED, true);
  });

  it('is true when the env var is "TRUE" (uppercase)', async () => {
    process.env.NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED = 'TRUE';
    const { SABFLOW_COLLAB_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_COLLAB_ENABLED, true);
  });
});

// ---------------------------------------------------------------------------
// SABFLOW_PLAYBACK_ENABLED
// ---------------------------------------------------------------------------

describe('SABFLOW_PLAYBACK_ENABLED', () => {
  let tick = 100;
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.NEXT_PUBLIC_SABFLOW_PLAYBACK_ENABLED;
    tick++;
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.NEXT_PUBLIC_SABFLOW_PLAYBACK_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_SABFLOW_PLAYBACK_ENABLED = saved;
    }
  });

  it('is false when the env var is unset', async () => {
    delete process.env.NEXT_PUBLIC_SABFLOW_PLAYBACK_ENABLED;
    const { SABFLOW_PLAYBACK_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_PLAYBACK_ENABLED, false);
  });

  it('is false when the env var is an empty string', async () => {
    process.env.NEXT_PUBLIC_SABFLOW_PLAYBACK_ENABLED = '';
    const { SABFLOW_PLAYBACK_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_PLAYBACK_ENABLED, false);
  });

  it('is true when the env var is "true"', async () => {
    process.env.NEXT_PUBLIC_SABFLOW_PLAYBACK_ENABLED = 'true';
    const { SABFLOW_PLAYBACK_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_PLAYBACK_ENABLED, true);
  });

  it('is true when the env var is "1"', async () => {
    process.env.NEXT_PUBLIC_SABFLOW_PLAYBACK_ENABLED = '1';
    const { SABFLOW_PLAYBACK_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_PLAYBACK_ENABLED, true);
  });

  it('is true when the env var is "TRUE"', async () => {
    process.env.NEXT_PUBLIC_SABFLOW_PLAYBACK_ENABLED = 'TRUE';
    const { SABFLOW_PLAYBACK_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_PLAYBACK_ENABLED, true);
  });
});

// ---------------------------------------------------------------------------
// SABFLOW_MARKETPLACE_ENABLED  (on by default)
// ---------------------------------------------------------------------------

describe('SABFLOW_MARKETPLACE_ENABLED', () => {
  let tick = 200;
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.NEXT_PUBLIC_SABFLOW_MARKETPLACE_ENABLED;
    tick++;
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.NEXT_PUBLIC_SABFLOW_MARKETPLACE_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_SABFLOW_MARKETPLACE_ENABLED = saved;
    }
  });

  it('is true when the env var is unset (on by default)', async () => {
    delete process.env.NEXT_PUBLIC_SABFLOW_MARKETPLACE_ENABLED;
    const { SABFLOW_MARKETPLACE_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_MARKETPLACE_ENABLED, true);
  });

  it('is true when the env var is an empty string (on by default)', async () => {
    process.env.NEXT_PUBLIC_SABFLOW_MARKETPLACE_ENABLED = '';
    const { SABFLOW_MARKETPLACE_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_MARKETPLACE_ENABLED, true);
  });

  it('is true when the env var is "true"', async () => {
    process.env.NEXT_PUBLIC_SABFLOW_MARKETPLACE_ENABLED = 'true';
    const { SABFLOW_MARKETPLACE_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_MARKETPLACE_ENABLED, true);
  });

  it('is false when the env var is "false"', async () => {
    process.env.NEXT_PUBLIC_SABFLOW_MARKETPLACE_ENABLED = 'false';
    const { SABFLOW_MARKETPLACE_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_MARKETPLACE_ENABLED, false);
  });

  it('is false when the env var is "0"', async () => {
    process.env.NEXT_PUBLIC_SABFLOW_MARKETPLACE_ENABLED = '0';
    const { SABFLOW_MARKETPLACE_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_MARKETPLACE_ENABLED, false);
  });

  it('is false when the env var is "FALSE" (uppercase)', async () => {
    process.env.NEXT_PUBLIC_SABFLOW_MARKETPLACE_ENABLED = 'FALSE';
    const { SABFLOW_MARKETPLACE_ENABLED } = await loadFeatures(tick);
    assert.equal(SABFLOW_MARKETPLACE_ENABLED, false);
  });
});
