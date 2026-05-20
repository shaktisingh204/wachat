/**
 * Tests for the block → brand-icon mapping.
 *
 *   npx tsx --test src/lib/sabflow/blocks/__tests__/icons.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { BRAND_ICON_COUNT, getBlockBrandIcon } from '../icons';

test('returns full-colour Slack logo (not the monochrome silhouette)', () => {
  // `logos:` namespace = full-colour brand mark. `simple-icons:` = monochrome.
  // The user explicitly wants n8n-style colour logos, so this asserts the
  // mapping never silently degrades to simple-icons.
  assert.equal(getBlockBrandIcon('forge_slack'), 'logos:slack-icon');
});

test('v1 / v2 suffixes map to the same brand icon', () => {
  assert.equal(
    getBlockBrandIcon('forge_slack_v1'),
    getBlockBrandIcon('forge_slack'),
  );
  assert.equal(
    getBlockBrandIcon('forge_http_request_v2'),
    getBlockBrandIcon('forge_http_request'),
  );
});

test('returns null for unmapped block types', () => {
  assert.equal(getBlockBrandIcon('forge_some_random_unknown_provider'), null);
});

test('returns null for non-forge built-in blocks without mapping', () => {
  assert.equal(getBlockBrandIcon('text'), null);
  assert.equal(getBlockBrandIcon('condition'), null);
});

test('built-in webhook + send_email blocks have icons', () => {
  assert.equal(getBlockBrandIcon('webhook'), 'mdi:webhook');
  assert.equal(getBlockBrandIcon('send_email'), 'mdi:email-outline');
});

test('AI providers map to full-colour brand logos', () => {
  assert.equal(getBlockBrandIcon('forge_openai'), 'logos:openai-icon');
  assert.equal(getBlockBrandIcon('forge_anthropic'), 'logos:anthropic-icon');
  assert.equal(getBlockBrandIcon('open_ai'), 'logos:openai-icon');
});

test('CRM blocks resolve to full-colour logos', () => {
  assert.equal(getBlockBrandIcon('forge_hubspot'), 'logos:hubspot');
  assert.equal(getBlockBrandIcon('forge_salesforce'), 'logos:salesforce');
  assert.equal(getBlockBrandIcon('forge_pipedrive'), 'logos:pipedrive');
});

test('storage blocks resolve to full-colour logos', () => {
  assert.equal(getBlockBrandIcon('forge_aws_s3'), 'logos:aws-s3');
  assert.equal(getBlockBrandIcon('forge_dropbox'), 'logos:dropbox');
});

test('database blocks resolve to full-colour logos', () => {
  assert.equal(getBlockBrandIcon('forge_postgres'), 'logos:postgresql');
  assert.equal(getBlockBrandIcon('forge_mongodb'), 'logos:mongodb-icon');
  assert.equal(getBlockBrandIcon('forge_redis'), 'logos:redis');
});

test('top-tier brands all use the colour logos: namespace', () => {
  // Guard rail: catch a future PR that downgrades a mapping back to
  // simple-icons (monochrome silhouette). The brands listed here are the
  // ones the user explicitly compared to n8n's screenshot.
  const mustBeColour = [
    'forge_slack', 'forge_discord', 'forge_telegram', 'forge_whatsapp',
    'forge_notion', 'forge_airtable', 'forge_google_sheets',
    'forge_hubspot', 'forge_salesforce', 'forge_pipedrive',
    'forge_github', 'forge_gitlab',
    'forge_stripe', 'forge_shopify',
    'forge_openai', 'forge_anthropic',
    'forge_dropbox', 'forge_aws_s3',
    'forge_postgres', 'forge_mongodb', 'forge_redis',
  ];
  for (const t of mustBeColour) {
    const name = getBlockBrandIcon(t);
    assert.ok(
      name && name.startsWith('logos:'),
      `${t} should use logos: namespace, got ${name}`,
    );
  }
});

test('explicit mapping table has at least 100 entries', () => {
  // Sanity check — if someone accidentally truncates the table we want a
  // loud test failure rather than a silent regression.
  assert.ok(
    BRAND_ICON_COUNT >= 100,
    `Expected ≥ 100 explicit mappings, got ${BRAND_ICON_COUNT}`,
  );
});

test('derivation fallback returns simple-icons for known providers', () => {
  assert.equal(getBlockBrandIcon('forge_spotify'), 'simple-icons:spotify');
  assert.equal(getBlockBrandIcon('forge_figma'), 'simple-icons:figma');
});
