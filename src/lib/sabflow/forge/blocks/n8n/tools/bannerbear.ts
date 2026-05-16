/**
 * Forge block: Bannerbear
 *
 * Source: n8n-master/packages/nodes-base/nodes/Bannerbear/Bannerbear.node.ts
 * Credential type: 'bannerbear' (CREDENTIAL_FIELD_SCHEMAS → { apiKey }).
 *
 * Auth: Bearer apiKey, base `https://api.bannerbear.com/v2`.
 *
 * Operations covered:
 *   - image.create        POST  /images           — generate a new image from a template
 *   - image.get           GET   /images/{id}      — retrieve a generated image
 *   - template.get        GET   /templates/{id}   — fetch one template
 *   - template.list       GET   /templates        — list all templates
 *
 * Deferred:
 *   - waitForImage polling loop (use n8n-style retry block outside)
 *   - webhook callbacks
 *   - binary image download (handled by SabFiles)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.bannerbear.com/v2';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Bannerbear', ctx.credential);
  const apiKey = cred.apiKey;
  if (!apiKey) throw new Error('Bannerbear: credential is missing `apiKey`');
  return { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
}

function parseJsonOrEmpty(v: unknown, label: string): unknown {
  const s = asString(v).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`Bannerbear: ${label} must be valid JSON`);
  }
}

// ── Actions ────────────────────────────────────────────────────────────────

async function imageCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const templateId = asString(ctx.options.templateId);
  if (!templateId) throw new Error('Bannerbear: templateId is required');

  const modifications = parseJsonOrEmpty(ctx.options.modifications, 'modifications') ?? [];
  const metadata = asString(ctx.options.metadata) || undefined;
  const webhookUrl = asString(ctx.options.webhookUrl) || undefined;

  const body: Record<string, unknown> = { template: templateId, modifications };
  if (metadata) body.metadata = metadata;
  if (webhookUrl) body.webhook_url = webhookUrl;

  const res = await apiRequest({
    service: 'Bannerbear',
    method: 'POST',
    url: `${BASE}/images`,
    headers: authHeaders(ctx),
    json: body,
  });

  const data = res.data as { uid?: string; image_url?: string };
  return {
    outputs: { image: data, id: data.uid ?? null, imageUrl: data.image_url ?? null },
    logs: [`Bannerbear image create → ${data.uid ?? '?'}`],
  };
}

async function imageGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const imageId = asString(ctx.options.imageId);
  if (!imageId) throw new Error('Bannerbear: imageId is required');

  const res = await apiRequest({
    service: 'Bannerbear',
    method: 'GET',
    url: `${BASE}/images/${encodeURIComponent(imageId)}`,
    headers: authHeaders(ctx),
  });

  return {
    outputs: { image: res.data },
    logs: [`Bannerbear image get → ${imageId}`],
  };
}

async function templateGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const templateId = asString(ctx.options.templateId);
  if (!templateId) throw new Error('Bannerbear: templateId is required');

  const res = await apiRequest({
    service: 'Bannerbear',
    method: 'GET',
    url: `${BASE}/templates/${encodeURIComponent(templateId)}`,
    headers: authHeaders(ctx),
  });

  return {
    outputs: { template: res.data },
    logs: [`Bannerbear template get → ${templateId}`],
  };
}

async function templateList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Bannerbear',
    method: 'GET',
    url: `${BASE}/templates`,
    headers: authHeaders(ctx),
  });

  const list = Array.isArray(res.data) ? res.data : [];
  return {
    outputs: { templates: list, count: list.length },
    logs: [`Bannerbear template list → ${list.length}`],
  };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_bannerbear',
  name: 'Bannerbear',
  description: 'Generate images from templates with the Bannerbear API.',
  iconName: 'LuImage',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'bannerbear',
  },
  actions: [
    {
      id: 'image_create',
      label: 'Create image',
      description: 'Generate a new image from a Bannerbear template.',
      fields: [
        { id: 'templateId', label: 'Template ID', type: 'text', required: true },
        {
          id: 'modifications',
          label: 'Modifications (JSON array)',
          type: 'json',
          placeholder: '[{"name":"title","text":"Hello"}]',
          helperText: 'Array of modification objects per Bannerbear docs.',
        },
        { id: 'metadata', label: 'Metadata', type: 'text' },
        { id: 'webhookUrl', label: 'Webhook URL', type: 'text' },
      ],
      run: imageCreate,
    },
    {
      id: 'image_get',
      label: 'Get image',
      description: 'Retrieve a generated image by id.',
      fields: [
        { id: 'imageId', label: 'Image ID (uid)', type: 'text', required: true },
      ],
      run: imageGet,
    },
    {
      id: 'template_get',
      label: 'Get template',
      description: 'Fetch a single template by id.',
      fields: [
        { id: 'templateId', label: 'Template ID', type: 'text', required: true },
      ],
      run: templateGet,
    },
    {
      id: 'template_list',
      label: 'List templates',
      description: 'List all templates on the project.',
      fields: [],
      run: templateList,
    },
  ],
};

registerForgeBlock(block);
export default block;
