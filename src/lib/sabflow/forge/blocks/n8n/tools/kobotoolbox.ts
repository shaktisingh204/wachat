/**
 * Forge block: KoBoToolbox
 *
 * Source: n8n-master/packages/nodes-base/nodes/KoBoToolbox/KoBoToolbox.node.ts
 * Credential type: 'kobotoolbox' (CREDENTIAL_FIELD_SCHEMAS → { baseUrl, apiToken }).
 *
 * Auth: header `Authorization: Token <apiToken>`, base from credential
 * (e.g. https://kf.kobotoolbox.org).
 *
 * Operations covered (form + submission subset):
 *   - form.list             GET  /api/v2/assets
 *   - form.get              GET  /api/v2/assets/{formId}
 *   - submission.list       GET  /api/v2/assets/{formId}/data
 *   - submission.get        GET  /api/v2/assets/{formId}/data/{id}
 *   - submission.delete     DELETE /api/v2/assets/{formId}/data/{id}
 *
 * Deferred:
 *   - paginator with `start`/`limit` cursor — first port uses default page only
 *   - hook resource (webhooks) — handled separately in trigger nodes
 *   - export-request long-poll
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('KoBoToolbox', ctx.credential);
  const apiToken = cred.apiToken ?? cred.token;
  if (!apiToken) throw new Error('KoBoToolbox: credential is missing `apiToken`');
  return { Authorization: `Token ${apiToken}`, Accept: 'application/json' };
}

function baseUrl(ctx: ForgeActionContext): string {
  const cred = requireCredential('KoBoToolbox', ctx.credential);
  const url = (cred.baseUrl ?? cred.URL ?? '').replace(/\/+$/, '');
  if (!url) throw new Error('KoBoToolbox: credential is missing `baseUrl`');
  return url;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function formList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const limit = asNumber(ctx.options.limit) ?? 100;
  const url = `${baseUrl(ctx)}/api/v2/assets/?limit=${limit}`;
  const res = await apiRequest({
    service: 'KoBoToolbox',
    method: 'GET',
    url,
    headers: authHeaders(ctx),
  });
  const data = res.data as { results?: unknown[]; count?: number };
  const results = Array.isArray(data?.results) ? data.results : [];
  return {
    outputs: { forms: results, count: data?.count ?? results.length },
    logs: [`KoBoToolbox form list → ${results.length}`],
  };
}

async function formGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const formId = asString(ctx.options.formId);
  if (!formId) throw new Error('KoBoToolbox: formId is required');
  const res = await apiRequest({
    service: 'KoBoToolbox',
    method: 'GET',
    url: `${baseUrl(ctx)}/api/v2/assets/${encodeURIComponent(formId)}/`,
    headers: authHeaders(ctx),
  });
  return {
    outputs: { form: res.data },
    logs: [`KoBoToolbox form get → ${formId}`],
  };
}

async function submissionList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const formId = asString(ctx.options.formId);
  if (!formId) throw new Error('KoBoToolbox: formId is required');
  const limit = asNumber(ctx.options.limit) ?? 100;
  const start = asNumber(ctx.options.start) ?? 0;
  const url =
    `${baseUrl(ctx)}/api/v2/assets/${encodeURIComponent(formId)}/data/?limit=${limit}&start=${start}`;
  const res = await apiRequest({
    service: 'KoBoToolbox',
    method: 'GET',
    url,
    headers: authHeaders(ctx),
  });
  const data = res.data as { results?: unknown[]; count?: number };
  const results = Array.isArray(data?.results) ? data.results : [];
  return {
    outputs: { submissions: results, count: data?.count ?? results.length },
    logs: [`KoBoToolbox submission list → ${formId} → ${results.length}`],
  };
}

async function submissionGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const formId = asString(ctx.options.formId);
  const submissionId = asString(ctx.options.submissionId);
  if (!formId) throw new Error('KoBoToolbox: formId is required');
  if (!submissionId) throw new Error('KoBoToolbox: submissionId is required');
  const res = await apiRequest({
    service: 'KoBoToolbox',
    method: 'GET',
    url:
      `${baseUrl(ctx)}/api/v2/assets/${encodeURIComponent(formId)}/data/${encodeURIComponent(submissionId)}/`,
    headers: authHeaders(ctx),
  });
  return {
    outputs: { submission: res.data },
    logs: [`KoBoToolbox submission get → ${submissionId}`],
  };
}

async function submissionDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const formId = asString(ctx.options.formId);
  const submissionId = asString(ctx.options.submissionId);
  if (!formId) throw new Error('KoBoToolbox: formId is required');
  if (!submissionId) throw new Error('KoBoToolbox: submissionId is required');
  const res = await apiRequest({
    service: 'KoBoToolbox',
    method: 'DELETE',
    url:
      `${baseUrl(ctx)}/api/v2/assets/${encodeURIComponent(formId)}/data/${encodeURIComponent(submissionId)}/`,
    headers: authHeaders(ctx),
  });
  return {
    outputs: { success: res.ok, status: res.status },
    logs: [`KoBoToolbox submission delete → ${submissionId}`],
  };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_kobotoolbox',
  name: 'KoBoToolbox',
  description: 'List forms and read submissions from a KoBoToolbox server.',
  iconName: 'LuClipboardList',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'kobotoolbox',
  },
  actions: [
    {
      id: 'form_list',
      label: 'List forms',
      description: 'List all forms / assets visible to the credential.',
      fields: [
        { id: 'limit', label: 'Limit', type: 'number', placeholder: '100' },
      ],
      run: formList,
    },
    {
      id: 'form_get',
      label: 'Get form',
      description: 'Fetch a single form by id.',
      fields: [
        { id: 'formId', label: 'Form ID (uid)', type: 'text', required: true },
      ],
      run: formGet,
    },
    {
      id: 'submission_list',
      label: 'List submissions',
      description: 'List submissions for a form.',
      fields: [
        { id: 'formId', label: 'Form ID (uid)', type: 'text', required: true },
        { id: 'limit', label: 'Limit', type: 'number', placeholder: '100' },
        { id: 'start', label: 'Start offset', type: 'number', placeholder: '0' },
      ],
      run: submissionList,
    },
    {
      id: 'submission_get',
      label: 'Get submission',
      description: 'Fetch one submission by id.',
      fields: [
        { id: 'formId', label: 'Form ID (uid)', type: 'text', required: true },
        { id: 'submissionId', label: 'Submission ID', type: 'text', required: true },
      ],
      run: submissionGet,
    },
    {
      id: 'submission_delete',
      label: 'Delete submission',
      description: 'Permanently remove a submission.',
      fields: [
        { id: 'formId', label: 'Form ID (uid)', type: 'text', required: true },
        { id: 'submissionId', label: 'Submission ID', type: 'text', required: true },
      ],
      run: submissionDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
