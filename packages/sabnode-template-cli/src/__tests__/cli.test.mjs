/**
 * Smoke tests for the sabnode-template CLI shim.
 *
 * Runs the bin/sabnode-template.mjs against a temp directory and asserts the
 * four scaffold files are produced and parse correctly.
 *
 * Run: `node --test packages/sabnode-template-cli/src/__tests__/cli.test.mjs`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PKG_ROOT = resolve(new URL('..', import.meta.url).pathname, '..');
const BIN = resolve(PKG_ROOT, 'bin/sabnode-template.mjs');

test('init scaffolds the 4 files with valid JSON', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'sabnode-cli-test-'));
  const result = spawnSync(
    process.execPath,
    [BIN, 'init', 'sample-template', '--dir', tmp, '--category', 'sales'],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, `CLI exit: ${result.status}\nstderr: ${result.stderr}`);

  const outDir = join(tmp, 'sample-template');
  assert.ok(existsSync(outDir), 'output directory exists');

  const tmpl = JSON.parse(readFileSync(join(outDir, 'template.json'), 'utf8'));
  assert.equal(tmpl.id, 'sample-template');
  assert.equal(tmpl.displayName, 'Sample Template');
  assert.equal(tmpl.category, 'sales');
  assert.ok(Array.isArray(tmpl.requiredCredentials));
  assert.ok(Array.isArray(tmpl.screenshots));

  const flow = JSON.parse(readFileSync(join(outDir, 'flow.json'), 'utf8'));
  assert.equal(flow.schemaVersion, 1);
  assert.ok(flow.trigger);
  assert.ok(Array.isArray(flow.blocks));
  assert.ok(Array.isArray(flow.edges));

  const verif = JSON.parse(readFileSync(join(outDir, 'verification.json'), 'utf8'));
  assert.equal(verif.templateId, 'sample-template');
  assert.ok(Array.isArray(verif.cases));
  assert.ok(verif.cases.length >= 1);

  const readme = readFileSync(join(outDir, 'README.md'), 'utf8');
  assert.match(readme, /Sample Template/);
  assert.match(readme, /sample-template/);
});

test('rejects non-kebab-case names', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'sabnode-cli-test-'));
  const result = spawnSync(
    process.execPath,
    [BIN, 'init', 'BadName', '--dir', tmp],
    { encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /kebab-case/);
});

test('rejects invalid category', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'sabnode-cli-test-'));
  const result = spawnSync(
    process.execPath,
    [BIN, 'init', 'ok-name', '--dir', tmp, '--category', 'nope'],
    { encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid category/);
});

test('refuses to overwrite without --force', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'sabnode-cli-test-'));
  const a = spawnSync(process.execPath, [BIN, 'init', 'twice', '--dir', tmp], {
    encoding: 'utf8',
  });
  assert.equal(a.status, 0, a.stderr);
  const b = spawnSync(process.execPath, [BIN, 'init', 'twice', '--dir', tmp], {
    encoding: 'utf8',
  });
  assert.notEqual(b.status, 0);
  assert.match(b.stderr, /Refusing to overwrite/);

  // --force should succeed
  const c = spawnSync(
    process.execPath,
    [BIN, 'init', 'twice', '--dir', tmp, '--force'],
    { encoding: 'utf8' },
  );
  assert.equal(c.status, 0, c.stderr);
});

test('standalone fallback script produces identical scaffold', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'sabnode-cli-test-'));
  // Locate repo root from PKG_ROOT
  const repoRoot = resolve(PKG_ROOT, '..', '..');
  const fallback = resolve(repoRoot, 'scripts/sabflow/template-init.mjs');
  assert.ok(existsSync(fallback), `fallback script must exist: ${fallback}`);

  const result = spawnSync(
    process.execPath,
    [fallback, 'fallback-template', '--dir', tmp, '--category', 'marketing'],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, `fallback exit: ${result.status}\nstderr: ${result.stderr}`);

  const outDir = join(tmp, 'fallback-template');
  for (const f of ['template.json', 'flow.json', 'verification.json', 'README.md']) {
    assert.ok(existsSync(join(outDir, f)), `${f} should exist`);
  }
});
