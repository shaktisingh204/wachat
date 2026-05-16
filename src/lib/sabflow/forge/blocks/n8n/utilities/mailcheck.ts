/**
 * Forge block: Mailcheck
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mailcheck/Mailcheck.node.ts
 *
 * Auth: `Authorization: Bearer <apiKey>`.
 *
 * Operations covered:
 *   - email.check        POST /v1/singleEmail:check
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.mailcheck.co/v1';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Mailcheck: apiKey is required');
  return { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
}

async function emailCheck(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Mailcheck: email is required');
  const res = await apiRequest({
    service: 'Mailcheck',
    method: 'POST',
    url: `${API}/singleEmail:check`,
    headers: authHeader(ctx),
    json: { email },
  });
  return { outputs: { result: res.data }, logs: [`Mailcheck email check → ${email}`] };
}

const block: ForgeBlock = {
  id: 'forge_mailcheck',
  name: 'Mailcheck',
  description: 'Verify email deliverability with Mailcheck.',
  iconName: 'LuMailCheck',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'email_check',
      label: 'Check email',
      description: 'Validate a single email address.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true, placeholder: 'name@example.com' },
      ],
      run: emailCheck,
    },
  ],
};

registerForgeBlock(block);
export default block;
