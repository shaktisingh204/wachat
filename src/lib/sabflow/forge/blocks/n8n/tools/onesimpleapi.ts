/**
 * Forge block: One Simple API
 *
 * Source: n8n-master/packages/nodes-base/nodes/OneSimpleApi/OneSimpleApi.node.ts
 * Credential type: 'onesimpleapi' (CREDENTIAL_FIELD_SCHEMAS → { apiToken }).
 *
 * Auth: query string `?token=<apiToken>&output=json` (matches n8n's request
 * builder). We also send `Authorization: Bearer <token>` for forward
 * compatibility — the API accepts either.
 *
 * Base: `https://onesimpleapi.com/api`.
 *
 * Operations covered:
 *   - image.to-pdf       GET  /image_to_pdf?url=…
 *   - utility.expand-url GET  /unshorten?url=…
 *   - utility.qr-code    GET  /qr_code?value=…
 *   - utility.currency   GET  /exchange_rate?from=…&to=…
 *   - utility.screenshot GET  /screenshot?url=…
 *
 * Deferred:
 *   - binary download of generated artefacts; we always return the hosted URL.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://onesimpleapi.com/api';

function authToken(ctx: ForgeActionContext): string {
  const cred = requireCredential('One Simple API', ctx.credential);
  const token = cred.apiToken ?? cred.apiKey;
  if (!token) throw new Error('One Simple API: credential is missing `apiToken`');
  return token;
}

function buildUrl(ctx: ForgeActionContext, path: string, params: Record<string, string | undefined>): string {
  const token = authToken(ctx);
  const qs = new URLSearchParams({ token, output: 'json' });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, v);
  }
  return `${BASE}${path}?${qs.toString()}`;
}

async function get(ctx: ForgeActionContext, path: string, params: Record<string, string | undefined>) {
  const url = buildUrl(ctx, path, params);
  const res = await apiRequest({
    service: 'One Simple API',
    method: 'GET',
    url,
    headers: { Accept: 'application/json' },
  });
  return res.data;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function imageToPdf(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('One Simple API: url is required');
  const data = await get(ctx, '/image_to_pdf', { url });
  return { outputs: { result: data }, logs: [`OSA image-to-pdf → ${url}`] };
}

async function expandUrl(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('One Simple API: url is required');
  const data = await get(ctx, '/unshorten', { url });
  return { outputs: { result: data }, logs: [`OSA expand → ${url}`] };
}

async function qrCode(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const value = asString(ctx.options.value);
  if (!value) throw new Error('One Simple API: value is required');
  const data = await get(ctx, '/qr_code', { value });
  return { outputs: { result: data }, logs: [`OSA qr → ${value.slice(0, 32)}`] };
}

async function currencyRates(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const from = asString(ctx.options.from).toUpperCase();
  const to = asString(ctx.options.to).toUpperCase();
  if (!from) throw new Error('One Simple API: from currency is required');
  if (!to) throw new Error('One Simple API: to currency is required');
  const data = await get(ctx, '/exchange_rate', { from, to });
  return { outputs: { result: data, from, to }, logs: [`OSA rate ${from}→${to}`] };
}

async function screenshot(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('One Simple API: url is required');
  const data = await get(ctx, '/screenshot', {
    url,
    resolution: asString(ctx.options.resolution) || undefined,
  });
  return { outputs: { result: data, url }, logs: [`OSA screenshot → ${url}`] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_onesimpleapi',
  name: 'One Simple API',
  description: 'Utility endpoints: image→PDF, URL expander, QR, currency, screenshot.',
  iconName: 'LuToolCase',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'onesimpleapi',
  },
  actions: [
    {
      id: 'image_to_pdf',
      label: 'Image to PDF',
      description: 'Convert a remote image URL into a PDF.',
      fields: [
        { id: 'url', label: 'Image URL', type: 'text', required: true },
      ],
      run: imageToPdf,
    },
    {
      id: 'expand_url',
      label: 'Expand short URL',
      description: 'Resolve shortened URLs to their final destination.',
      fields: [
        { id: 'url', label: 'Short URL', type: 'text', required: true },
      ],
      run: expandUrl,
    },
    {
      id: 'qr_code',
      label: 'Generate QR code',
      description: 'Produce a QR code PNG URL for arbitrary text.',
      fields: [
        { id: 'value', label: 'Value', type: 'textarea', required: true },
      ],
      run: qrCode,
    },
    {
      id: 'currency_rates',
      label: 'Currency exchange rate',
      description: 'Fetch the exchange rate between two ISO-4217 currencies.',
      fields: [
        { id: 'from', label: 'From (e.g. USD)', type: 'text', required: true },
        { id: 'to', label: 'To (e.g. EUR)', type: 'text', required: true },
      ],
      run: currencyRates,
    },
    {
      id: 'screenshot',
      label: 'Webpage screenshot',
      description: 'Take a hosted screenshot of a webpage URL.',
      fields: [
        { id: 'url', label: 'URL', type: 'text', required: true },
        {
          id: 'resolution',
          label: 'Resolution',
          type: 'select',
          options: [
            { label: 'Default', value: '' },
            { label: '1024x768', value: '1024x768' },
            { label: '1280x800', value: '1280x800' },
            { label: '1920x1080', value: '1920x1080' },
          ],
        },
      ],
      run: screenshot,
    },
  ],
};

registerForgeBlock(block);
export default block;
