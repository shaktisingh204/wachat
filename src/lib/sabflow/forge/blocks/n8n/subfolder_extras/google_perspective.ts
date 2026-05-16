/**
 * Forge block: Google Perspective (Comment Analyzer)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/Perspective/GooglePerspective.node.ts
 *
 * Auth: Perspective accepts either an OAuth2 access token or an API key on
 *   the URL. We support both; OAuth refresh-token fields are inline and an
 *   API key falls back when no clientId is provided.
 *
 * REST: https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze
 *
 * Operations:
 *   - analyzeComment — score toxicity / spam / threat etc.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { getOrRefreshAccessToken, GOOGLE_TOKEN_URL } from '../_shared/google_oauth';

const SERVICE = 'Google Perspective';
const URL_BASE = 'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze';

function maybeReadCred(ctx: ForgeActionContext): Record<string, string> | null {
  const clientId = asString(ctx.options.clientId);
  const clientSecret = asString(ctx.options.clientSecret);
  const refreshToken = asString(ctx.options.refreshToken);
  if (!clientId && !clientSecret && !refreshToken) return null;
  if (!clientId) throw new Error(`${SERVICE}: clientId is required when using OAuth`);
  if (!clientSecret) throw new Error(`${SERVICE}: clientSecret is required when using OAuth`);
  if (!refreshToken) throw new Error(`${SERVICE}: refreshToken is required when using OAuth`);
  return { clientId, clientSecret, refreshToken };
}

async function analyzeComment(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  if (!text) throw new Error(`${SERVICE}: text is required`);
  const attributesRaw = asString(ctx.options.attributes).trim();
  const languages = asString(ctx.options.languages).trim();

  const requestedAttributes: Record<string, unknown> = {};
  const attrList = attributesRaw
    ? attributesRaw.split(',').map((a) => a.trim()).filter(Boolean)
    : ['TOXICITY'];
  for (const attr of attrList) requestedAttributes[attr] = {};

  const body: Record<string, unknown> = {
    comment: { text },
    requestedAttributes,
  };
  if (languages) body.languages = languages.split(',').map((l) => l.trim()).filter(Boolean);

  const cred = maybeReadCred(ctx);
  const headers: Record<string, string> = {};
  let url = URL_BASE;
  if (cred) {
    const token = await getOrRefreshAccessToken(SERVICE, cred, GOOGLE_TOKEN_URL);
    headers.Authorization = `Bearer ${token}`;
  } else {
    const apiKey = asString(ctx.options.apiKey);
    if (!apiKey) throw new Error(`${SERVICE}: either OAuth credentials or an apiKey is required`);
    url = `${URL_BASE}?key=${encodeURIComponent(apiKey)}`;
  }
  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url,
    headers,
    json: body,
  });
  return { outputs: { result: res.data }, logs: ['Perspective analyzeComment'] };
}

const block: ForgeBlock = {
  id: 'forge_google_perspective',
  name: 'Google Perspective',
  description: 'Score comments for toxicity and similar attributes via Google Perspective.',
  iconName: 'LuShieldAlert',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'analyze_comment',
      label: 'Analyze comment',
      description: 'Run a Perspective analysis on a comment.',
      fields: [
        { id: 'clientId', label: 'Client ID (OAuth)', type: 'password' },
        { id: 'clientSecret', label: 'Client secret (OAuth)', type: 'password' },
        { id: 'refreshToken', label: 'Refresh token (OAuth)', type: 'password' },
        { id: 'apiKey', label: 'API key (alternative to OAuth)', type: 'password' },
        { id: 'text', label: 'Comment text', type: 'textarea', required: true },
        {
          id: 'attributes',
          label: 'Attributes (comma-separated)',
          type: 'text',
          placeholder: 'TOXICITY,INSULT,THREAT',
        },
        { id: 'languages', label: 'Languages (comma-separated)', type: 'text', placeholder: 'en' },
      ],
      run: analyzeComment,
    },
  ],
};

registerForgeBlock(block);
export default block;
