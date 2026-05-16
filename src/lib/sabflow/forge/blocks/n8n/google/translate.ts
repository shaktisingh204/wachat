/**
 * Forge block: Google Translate
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/Translate/GoogleTranslate.node.ts
 *
 * Auth: OAuth2 refresh-token grant; clientId/clientSecret/refreshToken inline
 *   per action. Access token refreshed per call and cached via _shared/oauth.ts.
 *
 * Operations covered:
 *   - text.translate  POST /language/translate/v2
 *   - language.list   GET  /language/translate/v2/languages
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import {
  cacheKeyFor,
  getCachedToken,
  refreshAccessToken,
  setCachedToken,
} from '../_shared/oauth';

const SERVICE = 'Google Translate';
const CACHE = 'google_translate';

type OAuthCred = { clientId: string; clientSecret: string; refreshToken: string };

function readCred(ctx: ForgeActionContext): OAuthCred {
  const clientId = asString(ctx.options.clientId);
  const clientSecret = asString(ctx.options.clientSecret);
  const refreshToken = asString(ctx.options.refreshToken);
  if (!clientId) throw new Error(`${SERVICE}: clientId is required`);
  if (!clientSecret) throw new Error(`${SERVICE}: clientSecret is required`);
  if (!refreshToken) throw new Error(`${SERVICE}: refreshToken is required`);
  return { clientId, clientSecret, refreshToken };
}

async function getOrRefreshAccessToken(cred: OAuthCred): Promise<string> {
  const key = cacheKeyFor(CACHE, cred.refreshToken);
  const cached = getCachedToken(key);
  if (cached) return cached;
  const { accessToken, expiresIn } = await refreshAccessToken({
    service: SERVICE,
    tokenUrl: 'https://oauth2.googleapis.com/token',
    refreshToken: cred.refreshToken,
    clientId: cred.clientId,
    clientSecret: cred.clientSecret,
  });
  setCachedToken(key, accessToken, expiresIn);
  return accessToken;
}

const authFields = [
  { id: 'clientId', label: 'Client ID', type: 'password' as const, required: true },
  { id: 'clientSecret', label: 'Client secret', type: 'password' as const, required: true },
  { id: 'refreshToken', label: 'Refresh token', type: 'password' as const, required: true },
];

// ── Actions ────────────────────────────────────────────────────────────────

async function textTranslate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const text = asString(ctx.options.text);
  const target = asString(ctx.options.target);
  if (!text) throw new Error(`${SERVICE}: text is required`);
  if (!target) throw new Error(`${SERVICE}: target language code is required`);
  const body: Record<string, unknown> = { q: text, target };
  const source = asString(ctx.options.source);
  const format = asString(ctx.options.format);
  if (source) body.source = source;
  if (format) body.format = format;
  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url: 'https://translation.googleapis.com/language/translate/v2',
    headers: { Authorization: `Bearer ${accessToken}` },
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Translate text → ${target}`] };
}

async function languageList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const params = new URLSearchParams();
  const target = asString(ctx.options.target);
  if (target) params.set('target', target);
  const qs = params.toString();
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `https://translation.googleapis.com/language/translate/v2/languages${qs ? `?${qs}` : ''}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: ['Translate language list'] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_google_translate',
  name: 'Google Translate',
  description: 'Translate text and list supported languages via Google Translate v2.',
  iconName: 'LuLanguages',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'text_translate',
      label: 'Translate text',
      description: 'Translate input text into the target language.',
      fields: [
        ...authFields,
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        { id: 'target', label: 'Target language code', type: 'text', required: true, placeholder: 'es' },
        { id: 'source', label: 'Source language code (optional)', type: 'text', placeholder: 'en' },
        {
          id: 'format',
          label: 'Format',
          type: 'select',
          options: [
            { label: 'text', value: 'text' },
            { label: 'html', value: 'html' },
          ],
        },
      ],
      run: textTranslate,
    },
    {
      id: 'language_list',
      label: 'List languages',
      description: 'List the languages supported by Google Translate.',
      fields: [
        ...authFields,
        { id: 'target', label: 'Display names language (optional)', type: 'text', placeholder: 'en' },
      ],
      run: languageList,
    },
  ],
};

registerForgeBlock(block);
export default block;
