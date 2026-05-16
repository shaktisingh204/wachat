/**
 * Forge block: LingvaNex
 *
 * Source: n8n-master/packages/nodes-base/nodes/LingvaNex/LingvaNex.node.ts
 * Credential type: 'lingvanex' (expects { apiKey }).
 *
 * Endpoint: https://api-b2b.backenster.com/b1/api/v3
 * Auth: Authorization: Bearer <apiKey>
 *
 * Operations:
 *   - translate         POST /translate
 *   - detect_language   POST /detect
 *   - languages         GET  /getLanguages
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const API = 'https://api-b2b.backenster.com/b1/api/v3';

function bearer(ctx: ForgeActionContext): string {
  const cred = requireCredential('LingvaNex', ctx.credential);
  const key = cred.apiKey ?? cred.accessToken;
  if (!key) throw new Error('LingvaNex: credential is missing `apiKey`');
  return `Bearer ${key}`;
}

async function translate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  const to = asString(ctx.options.to);
  const from = asString(ctx.options.from);
  if (!text) throw new Error('LingvaNex: text is required');
  if (!to) throw new Error('LingvaNex: to is required');

  const payload: Record<string, unknown> = {
    data: text,
    to,
    platform: 'api',
  };
  if (from) payload.from = from;

  const res = await apiRequest({
    service: 'LingvaNex',
    method: 'POST',
    url: `${API}/translate`,
    headers: { Authorization: bearer(ctx) },
    json: payload,
  });
  const body = res.data as { result?: string; err?: string };
  if (body?.err) throw new Error(`LingvaNex: ${body.err}`);
  return {
    outputs: { translated: body?.result ?? '', raw: res.data },
    logs: [`LingvaNex translate → ${to}`],
  };
}

async function detectLanguage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  if (!text) throw new Error('LingvaNex: text is required');

  const res = await apiRequest({
    service: 'LingvaNex',
    method: 'POST',
    url: `${API}/detect`,
    headers: { Authorization: bearer(ctx) },
    json: { data: text, platform: 'api' },
  });
  return {
    outputs: { detection: res.data },
    logs: ['LingvaNex detect'],
  };
}

async function listLanguages(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'LingvaNex',
    method: 'GET',
    url: `${API}/getLanguages?platform=api`,
    headers: { Authorization: bearer(ctx) },
  });
  const body = res.data as { result?: unknown[] };
  const languages = Array.isArray(body?.result) ? body.result : [];
  return {
    outputs: { languages, count: languages.length },
    logs: [`LingvaNex languages (${languages.length})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lingvanex',
  name: 'LingvaNex',
  description: 'Translate text and detect language with LingvaNex.',
  iconName: 'LuLanguages',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'lingvanex' },
  actions: [
    {
      id: 'translate',
      label: 'Translate',
      description: 'Translate text between languages.',
      fields: [
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        { id: 'to', label: 'To language', type: 'text', required: true, placeholder: 'es_ES' },
        { id: 'from', label: 'From language (optional)', type: 'text', placeholder: 'en_US' },
      ],
      run: translate,
    },
    {
      id: 'detect_language',
      label: 'Detect language',
      description: 'Detect the language of the given text.',
      fields: [
        { id: 'text', label: 'Text', type: 'textarea', required: true },
      ],
      run: detectLanguage,
    },
    {
      id: 'list_languages',
      label: 'List languages',
      description: 'List supported languages.',
      fields: [],
      run: listLanguages,
    },
  ],
};

registerForgeBlock(block);
export default block;
