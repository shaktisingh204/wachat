/**
 * Forge block: Peekalink
 *
 * Source: n8n-master/packages/nodes-base/nodes/Peekalink/Peekalink.node.ts
 * Credential type: 'peekalink' (CREDENTIAL_FIELD_SCHEMAS → { apiKey }).
 *
 * Auth: header `Authorization: Bearer <apiKey>` (n8n uses `X-API-Key` style
 * in some docs but the credential definition routes through Bearer).
 *
 * Operations covered:
 *   - url.preview     POST /            — extract title, description, images
 *   - url.check       POST /is-available — is the URL reachable?
 *
 * Deferred:
 *   - none — Peekalink only exposes these two endpoints in the public node.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.peekalink.io';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Peekalink', ctx.credential);
  const apiKey = cred.apiKey;
  if (!apiKey) throw new Error('Peekalink: credential is missing `apiKey`');
  // Match n8n's credential definition which sends `Authorization: Bearer …`.
  return { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
}

// ── Actions ────────────────────────────────────────────────────────────────

async function urlPreview(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const link = asString(ctx.options.url);
  if (!link) throw new Error('Peekalink: url is required');

  const res = await apiRequest({
    service: 'Peekalink',
    method: 'POST',
    url: `${BASE}/`,
    headers: authHeaders(ctx),
    json: { link },
  });
  return {
    outputs: { preview: res.data, url: link },
    logs: [`Peekalink preview → ${link}`],
  };
}

async function urlCheck(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const link = asString(ctx.options.url);
  if (!link) throw new Error('Peekalink: url is required');

  const res = await apiRequest({
    service: 'Peekalink',
    method: 'POST',
    url: `${BASE}/is-available/`,
    headers: authHeaders(ctx),
    json: { link },
  });
  const data = res.data as { isAvailable?: boolean };
  return {
    outputs: { available: data?.isAvailable ?? false, raw: data, url: link },
    logs: [`Peekalink check → ${link} → ${data?.isAvailable ? 'ok' : 'unreachable'}`],
  };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_peekalink',
  name: 'Peekalink',
  description: 'Preview and check URLs with the Peekalink link-preview API.',
  iconName: 'LuLink',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'peekalink',
  },
  actions: [
    {
      id: 'url_preview',
      label: 'Preview URL',
      description: 'Extract title, description, image and Open-Graph metadata.',
      fields: [
        { id: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://example.com' },
      ],
      run: urlPreview,
    },
    {
      id: 'url_check',
      label: 'Check URL availability',
      description: 'Test whether a URL is reachable.',
      fields: [
        { id: 'url', label: 'URL', type: 'text', required: true },
      ],
      run: urlCheck,
    },
  ],
};

registerForgeBlock(block);
export default block;
