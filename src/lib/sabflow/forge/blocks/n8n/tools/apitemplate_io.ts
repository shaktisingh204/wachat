/**
 * Forge block: APITemplate.io
 *
 * Source: n8n-master/packages/nodes-base/nodes/ApiTemplateIo/ApiTemplateIo.node.ts
 * Credential type: 'apitemplate_io' (CREDENTIAL_FIELD_SCHEMAS → { apiKey }).
 *
 * Auth: header `X-API-KEY: <apiKey>`, base `https://api.apitemplate.io/v1`.
 *
 * Operations covered:
 *   - pdf.create        POST /create?template_id=… (data)  — generate a PDF
 *   - image.create      POST /create?template_id=… (data)  — generate JPEG/PNG
 *   - account.info      GET  /account-information
 *   - template.list     GET  /list-templates
 *
 * Deferred:
 *   - object-array overrides for placeholder coordinates
 *   - binary download into SabFiles (we return the download URL)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.apitemplate.io/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('APITemplate.io', ctx.credential);
  const apiKey = cred.apiKey;
  if (!apiKey) throw new Error('APITemplate.io: credential is missing `apiKey`');
  return { 'X-API-KEY': apiKey, Accept: 'application/json' };
}

function parseDataPayload(v: unknown): unknown {
  const s = asString(v).trim();
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    throw new Error('APITemplate.io: data must be valid JSON');
  }
}

// ── Actions ────────────────────────────────────────────────────────────────

async function pdfCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const templateId = asString(ctx.options.templateId);
  if (!templateId) throw new Error('APITemplate.io: templateId is required');
  const data = parseDataPayload(ctx.options.data);

  const url = `${BASE}/create?template_id=${encodeURIComponent(templateId)}`;
  const res = await apiRequest({
    service: 'APITemplate.io',
    method: 'POST',
    url,
    headers: authHeaders(ctx),
    json: data,
  });
  const body = res.data as { status?: string; download_url?: string; transaction_ref?: string; message?: string };
  if (body?.status && body.status !== 'success') {
    throw new Error(`APITemplate.io: ${body.message ?? body.status}`);
  }
  return {
    outputs: { pdf: body, downloadUrl: body?.download_url ?? null, id: body?.transaction_ref ?? null },
    logs: [`APITemplate.io pdf create → ${body?.transaction_ref ?? '?'}`],
  };
}

async function imageCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const templateId = asString(ctx.options.templateId);
  if (!templateId) throw new Error('APITemplate.io: templateId is required');
  const data = parseDataPayload(ctx.options.data);

  const url = `${BASE}/create?template_id=${encodeURIComponent(templateId)}`;
  const res = await apiRequest({
    service: 'APITemplate.io',
    method: 'POST',
    url,
    headers: authHeaders(ctx),
    json: data,
  });
  const body = res.data as { status?: string; download_url_jpeg?: string; download_url_png?: string; transaction_ref?: string; message?: string };
  if (body?.status && body.status !== 'success') {
    throw new Error(`APITemplate.io: ${body.message ?? body.status}`);
  }
  return {
    outputs: {
      image: body,
      downloadUrlPng: body?.download_url_png ?? null,
      downloadUrlJpeg: body?.download_url_jpeg ?? null,
      id: body?.transaction_ref ?? null,
    },
    logs: [`APITemplate.io image create → ${body?.transaction_ref ?? '?'}`],
  };
}

async function accountInfo(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'APITemplate.io',
    method: 'GET',
    url: `${BASE}/account-information`,
    headers: authHeaders(ctx),
  });
  return {
    outputs: { account: res.data },
    logs: ['APITemplate.io account info'],
  };
}

async function templateList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'APITemplate.io',
    method: 'GET',
    url: `${BASE}/list-templates`,
    headers: authHeaders(ctx),
  });
  const list = Array.isArray(res.data) ? res.data : [];
  return {
    outputs: { templates: list, count: list.length },
    logs: [`APITemplate.io template list → ${list.length}`],
  };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_apitemplate_io',
  name: 'APITemplate.io',
  description: 'Generate PDFs and images from APITemplate.io templates.',
  iconName: 'LuFileText',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'apitemplate_io',
  },
  actions: [
    {
      id: 'pdf_create',
      label: 'Create PDF',
      description: 'Render a PDF from a template with a JSON data payload.',
      fields: [
        { id: 'templateId', label: 'Template ID', type: 'text', required: true },
        {
          id: 'data',
          label: 'Data (JSON)',
          type: 'json',
          placeholder: '{"title":"Invoice 42"}',
          required: true,
        },
      ],
      run: pdfCreate,
    },
    {
      id: 'image_create',
      label: 'Create image',
      description: 'Render a JPEG/PNG from a template with a JSON data payload.',
      fields: [
        { id: 'templateId', label: 'Template ID', type: 'text', required: true },
        {
          id: 'data',
          label: 'Data (JSON)',
          type: 'json',
          placeholder: '{"name":"Acme"}',
          required: true,
        },
      ],
      run: imageCreate,
    },
    {
      id: 'account_info',
      label: 'Get account info',
      description: 'Fetch your APITemplate.io account / plan usage.',
      fields: [],
      run: accountInfo,
    },
    {
      id: 'template_list',
      label: 'List templates',
      description: 'List all templates in the account.',
      fields: [],
      run: templateList,
    },
  ],
};

registerForgeBlock(block);
export default block;
