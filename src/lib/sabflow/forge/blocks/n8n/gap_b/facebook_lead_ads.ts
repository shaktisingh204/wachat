/**
 * Forge block: Facebook Lead Ads
 *
 * Source: n8n-master/packages/nodes-base/nodes/FacebookLeadAds
 *
 * Base URL: https://graph.facebook.com/v25.0
 * Auth: Bearer access token (page access token with leads_retrieval scope).
 *
 * Operations covered:
 *   - lead.list         GET /{form_id}/leads
 *   - lead.get          GET /{lead_id}
 *   - form.list         GET /{page_id}/leadgen_forms
 *   - form.get          GET /{form_id}
 *
 * Inline credentials — `auth: { type: 'none' }`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://graph.facebook.com/v25.0';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('Facebook Lead Ads: accessToken is required');
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function leadList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const formId = asString(ctx.options.formId);
  if (!formId) throw new Error('Facebook Lead Ads: formId is required');
  const params = new URLSearchParams();
  const limit = asString(ctx.options.limit);
  const fields = asString(ctx.options.fields);
  if (limit) params.set('limit', limit);
  if (fields) params.set('fields', fields);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Facebook Lead Ads',
    method: 'GET',
    url: `${API}/${encodeURIComponent(formId)}/leads${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  const body = res.data as { data?: unknown[] };
  const list = body?.data ?? [];
  return {
    outputs: { leads: list, count: Array.isArray(list) ? list.length : 0, raw: res.data },
    logs: [`Facebook Lead Ads leads list → ${Array.isArray(list) ? list.length : 0}`],
  };
}

async function leadGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const leadId = asString(ctx.options.leadId);
  if (!leadId) throw new Error('Facebook Lead Ads: leadId is required');
  const params = new URLSearchParams();
  const fields = asString(ctx.options.fields);
  if (fields) params.set('fields', fields);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Facebook Lead Ads',
    method: 'GET',
    url: `${API}/${encodeURIComponent(leadId)}${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return {
    outputs: { lead: res.data },
    logs: [`Facebook Lead Ads lead get → ${leadId}`],
  };
}

async function formList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const pageId = asString(ctx.options.pageId);
  if (!pageId) throw new Error('Facebook Lead Ads: pageId is required');
  const params = new URLSearchParams();
  const limit = asString(ctx.options.limit);
  if (limit) params.set('limit', limit);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Facebook Lead Ads',
    method: 'GET',
    url: `${API}/${encodeURIComponent(pageId)}/leadgen_forms${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  const body = res.data as { data?: unknown[] };
  const list = body?.data ?? [];
  return {
    outputs: { forms: list, count: Array.isArray(list) ? list.length : 0, raw: res.data },
    logs: [`Facebook Lead Ads forms list → ${Array.isArray(list) ? list.length : 0}`],
  };
}

async function formGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const formId = asString(ctx.options.formId);
  if (!formId) throw new Error('Facebook Lead Ads: formId is required');
  const res = await apiRequest({
    service: 'Facebook Lead Ads',
    method: 'GET',
    url: `${API}/${encodeURIComponent(formId)}`,
    headers: authHeaders(ctx),
  });
  return {
    outputs: { form: res.data },
    logs: [`Facebook Lead Ads form get → ${formId}`],
  };
}

const inlineCreds = [
  {
    id: 'accessToken',
    label: 'Page access token',
    type: 'password' as const,
    required: true,
    helperText: 'Requires leads_retrieval scope.',
  },
];

const block: ForgeBlock = {
  id: 'forge_facebook_lead_ads',
  name: 'Facebook Lead Ads',
  description: 'Read leads and lead-gen forms from the Facebook Marketing API.',
  iconName: 'LuMegaphone',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'lead_list',
      label: 'List leads',
      description: 'GET /{form_id}/leads.',
      fields: [
        ...inlineCreds,
        { id: 'formId', label: 'Form ID', type: 'text', required: true },
        { id: 'fields', label: 'Fields (comma-separated)', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: leadList,
    },
    {
      id: 'lead_get',
      label: 'Get lead',
      description: 'GET /{lead_id}.',
      fields: [
        ...inlineCreds,
        { id: 'leadId', label: 'Lead ID', type: 'text', required: true },
        { id: 'fields', label: 'Fields (comma-separated)', type: 'text' },
      ],
      run: leadGet,
    },
    {
      id: 'form_list',
      label: 'List forms',
      description: 'GET /{page_id}/leadgen_forms.',
      fields: [
        ...inlineCreds,
        { id: 'pageId', label: 'Page ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: formList,
    },
    {
      id: 'form_get',
      label: 'Get form',
      description: 'GET /{form_id}.',
      fields: [
        ...inlineCreds,
        { id: 'formId', label: 'Form ID', type: 'text', required: true },
      ],
      run: formGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
