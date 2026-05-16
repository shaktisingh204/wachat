/**
 * Forge block: Google Cloud Natural Language
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/CloudNaturalLanguage/GoogleCloudNaturalLanguage.node.ts
 *
 * Auth: OAuth2 refresh-token grant; clientId/clientSecret/refreshToken inline.
 *
 * REST base: https://language.googleapis.com/v1
 *
 * Operations:
 *   - analyzeSentiment POST /documents:analyzeSentiment
 *   - analyzeEntities  POST /documents:analyzeEntities
 *   - analyzeSyntax    POST /documents:analyzeSyntax
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { getOrRefreshAccessToken, GOOGLE_TOKEN_URL } from '../_shared/google_oauth';

const SERVICE = 'Google Cloud Natural Language';
const BASE = 'https://language.googleapis.com/v1';

function readCred(ctx: ForgeActionContext): Record<string, string> {
  const clientId = asString(ctx.options.clientId);
  const clientSecret = asString(ctx.options.clientSecret);
  const refreshToken = asString(ctx.options.refreshToken);
  if (!clientId) throw new Error(`${SERVICE}: clientId is required`);
  if (!clientSecret) throw new Error(`${SERVICE}: clientSecret is required`);
  if (!refreshToken) throw new Error(`${SERVICE}: refreshToken is required`);
  return { clientId, clientSecret, refreshToken };
}

async function analyze(ctx: ForgeActionContext, op: string): Promise<unknown> {
  const text = asString(ctx.options.content);
  if (!text) throw new Error(`${SERVICE}: content is required`);
  const type = asString(ctx.options.documentType) || 'PLAIN_TEXT';
  const language = asString(ctx.options.language);
  const encodingType = asString(ctx.options.encodingType) || 'UTF8';
  const document: Record<string, unknown> = { type, content: text };
  if (language) document.language = language;
  const token = await getOrRefreshAccessToken(SERVICE, readCred(ctx), GOOGLE_TOKEN_URL);
  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url: `${BASE}/documents:${op}`,
    headers: { Authorization: `Bearer ${token}` },
    json: { document, encodingType },
  });
  return res.data;
}

const authFields = [
  { id: 'clientId', label: 'Client ID', type: 'password' as const, required: true },
  { id: 'clientSecret', label: 'Client secret', type: 'password' as const, required: true },
  { id: 'refreshToken', label: 'Refresh token', type: 'password' as const, required: true },
];

const contentFields = [
  { id: 'content', label: 'Content', type: 'textarea' as const, required: true },
  { id: 'documentType', label: 'Document type', type: 'text' as const, placeholder: 'PLAIN_TEXT' },
  { id: 'language', label: 'Language (BCP-47)', type: 'text' as const, placeholder: 'en' },
  { id: 'encodingType', label: 'Encoding type', type: 'text' as const, placeholder: 'UTF8' },
];

async function analyzeSentiment(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await analyze(ctx, 'analyzeSentiment');
  return { outputs: { result: data }, logs: ['CNL analyzeSentiment'] };
}

async function analyzeEntities(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await analyze(ctx, 'analyzeEntities');
  return { outputs: { result: data }, logs: ['CNL analyzeEntities'] };
}

async function analyzeSyntax(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await analyze(ctx, 'analyzeSyntax');
  return { outputs: { result: data }, logs: ['CNL analyzeSyntax'] };
}

const block: ForgeBlock = {
  id: 'forge_google_cnl',
  name: 'Google Cloud Natural Language',
  description: 'Analyze sentiment, entities, and syntax with Google Cloud Natural Language.',
  iconName: 'LuLanguages',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'analyze_sentiment',
      label: 'Analyze sentiment',
      description: 'Detect overall sentiment of a piece of text.',
      fields: [...authFields, ...contentFields],
      run: analyzeSentiment,
    },
    {
      id: 'analyze_entities',
      label: 'Analyze entities',
      description: 'Extract entities (people, places, things) from text.',
      fields: [...authFields, ...contentFields],
      run: analyzeEntities,
    },
    {
      id: 'analyze_syntax',
      label: 'Analyze syntax',
      description: 'Run a syntactic analysis (tokens, POS, dependencies).',
      fields: [...authFields, ...contentFields],
      run: analyzeSyntax,
    },
  ],
};

registerForgeBlock(block);
export default block;
