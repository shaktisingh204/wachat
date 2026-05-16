/**
 * Forge block: Humantic AI
 *
 * Source: n8n-master/packages/nodes-base/nodes/HumanticAI/HumanticAi.node.ts
 * Credential type: 'humantic_ai' (expects { apiKey }).
 *
 * Endpoint: https://api.humantic.ai/v1
 *
 * Operations:
 *   - profile.create_from_text   POST /user-profile/create?apikey=… (body: text)
 *   - profile.create_from_url    POST /user-profile/create?apikey=… (body: url)
 *   - profile.get                GET  /user-profile?apikey=…&userid=…
 *   - assessment.list            GET  /assessments?apikey=…
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const API = 'https://api.humantic.ai/v1';

function apiKey(ctx: ForgeActionContext): string {
  const cred = requireCredential('Humantic AI', ctx.credential);
  const key = cred.apiKey ?? cred.accessToken;
  if (!key) throw new Error('Humantic AI: credential is missing `apiKey`');
  return key;
}

async function predictFromText(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  const userId = asString(ctx.options.userId);
  if (!text) throw new Error('Humantic AI: text is required');
  if (!userId) throw new Error('Humantic AI: userId is required');

  const params = new URLSearchParams({ apikey: apiKey(ctx), userid: userId });
  const res = await apiRequest({
    service: 'Humantic AI',
    method: 'POST',
    url: `${API}/user-profile/create?${params.toString()}`,
    json: { text },
  });
  return {
    outputs: { profile: res.data },
    logs: [`Humantic AI predict (text) → ${userId}`],
  };
}

async function predictFromUrl(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  const userId = asString(ctx.options.userId);
  if (!url) throw new Error('Humantic AI: url is required');
  if (!userId) throw new Error('Humantic AI: userId is required');

  const params = new URLSearchParams({ apikey: apiKey(ctx), userid: userId });
  const res = await apiRequest({
    service: 'Humantic AI',
    method: 'POST',
    url: `${API}/user-profile/create?${params.toString()}`,
    json: { url },
  });
  return {
    outputs: { profile: res.data },
    logs: [`Humantic AI predict (url) → ${userId}`],
  };
}

async function profileGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const userId = asString(ctx.options.userId);
  if (!userId) throw new Error('Humantic AI: userId is required');
  const params = new URLSearchParams({ apikey: apiKey(ctx), userid: userId });

  const res = await apiRequest({
    service: 'Humantic AI',
    method: 'GET',
    url: `${API}/user-profile?${params.toString()}`,
  });
  return { outputs: { profile: res.data }, logs: [`Humantic AI profile get → ${userId}`] };
}

async function assessmentList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams({ apikey: apiKey(ctx) });
  const res = await apiRequest({
    service: 'Humantic AI',
    method: 'GET',
    url: `${API}/assessments?${params.toString()}`,
  });
  const data = res.data as { assessments?: unknown[] };
  const assessments = Array.isArray(data?.assessments) ? data.assessments : [];
  return {
    outputs: { assessments, raw: res.data, count: assessments.length },
    logs: [`Humantic AI assessments (${assessments.length})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_humantic_ai',
  name: 'Humantic AI',
  description: 'Generate personality profiles from text or web URLs.',
  iconName: 'LuUser',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'humantic_ai' },
  actions: [
    {
      id: 'predict_from_text',
      label: 'Predict from text',
      description: 'Build a personality profile from a chunk of written text.',
      fields: [
        { id: 'userId', label: 'User ID', type: 'text', required: true },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
      ],
      run: predictFromText,
    },
    {
      id: 'predict_from_url',
      label: 'Predict from URL',
      description: 'Build a profile from a public URL (LinkedIn, etc.).',
      fields: [
        { id: 'userId', label: 'User ID', type: 'text', required: true },
        { id: 'url', label: 'URL', type: 'text', required: true },
      ],
      run: predictFromUrl,
    },
    {
      id: 'profile_get',
      label: 'Get profile',
      description: 'Retrieve a previously created profile.',
      fields: [
        { id: 'userId', label: 'User ID', type: 'text', required: true },
      ],
      run: profileGet,
    },
    {
      id: 'assessment_list',
      label: 'List assessments',
      description: 'List assessments available on the account.',
      fields: [],
      run: assessmentList,
    },
  ],
};

registerForgeBlock(block);
export default block;
