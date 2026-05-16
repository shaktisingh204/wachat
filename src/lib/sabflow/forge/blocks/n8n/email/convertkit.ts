/**
 * Forge block: ConvertKit (now Kit)
 *
 * Source: n8n-master/packages/nodes-base/nodes/ConvertKit/ConvertKit.node.ts
 * Credential type: 'convertkit' (apiSecret)
 *
 * Auth: ConvertKit's v3 API takes the secret as a `api_secret` query param.
 *
 * Operations covered:
 *   - subscriber.formSubscribe   POST  /forms/{formId}/subscribe
 *   - subscriber.unsubscribe     PUT   /unsubscribe
 *   - subscriber.get             GET   /subscribers/{id}
 *   - tag.addSubscriber          POST  /tags/{tagId}/subscribe
 *
 * Out of scope for the first port:
 *   - LoadOptions for forms/tags/sequences
 *   - Sequence add/remove, custom fields, broadcasts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.convertkit.com/v3';

function getSecret(ctx: ForgeActionContext): string {
  const cred = requireCredential('ConvertKit', ctx.credential);
  const apiSecret = cred.apiSecret ?? '';
  if (!apiSecret) throw new Error('ConvertKit: credential is missing `apiSecret`');
  return apiSecret;
}

async function subscriberFormSubscribe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = getSecret(ctx);
  const formId = asString(ctx.options.formId);
  const email = asString(ctx.options.email);
  if (!formId) throw new Error('ConvertKit: formId is required');
  if (!email) throw new Error('ConvertKit: email is required');
  const body: Record<string, unknown> = { email, api_secret: secret };
  const firstName = asString(ctx.options.firstName);
  if (firstName) body.first_name = firstName;
  const tagsRaw = asString(ctx.options.tags);
  if (tagsRaw) body.tags = tagsRaw.split(',').map((s) => s.trim()).filter(Boolean);

  const res = await apiRequest({
    service: 'ConvertKit',
    method: 'POST',
    url: `${BASE}/forms/${encodeURIComponent(formId)}/subscribe`,
    json: body,
  });
  return { outputs: { subscription: res.data }, logs: [`ConvertKit form subscribe → ${email}`] };
}

async function subscriberUnsubscribe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = getSecret(ctx);
  const email = asString(ctx.options.email);
  if (!email) throw new Error('ConvertKit: email is required');
  const res = await apiRequest({
    service: 'ConvertKit',
    method: 'PUT',
    url: `${BASE}/unsubscribe`,
    json: { email, api_secret: secret },
  });
  return { outputs: { result: res.data, success: true }, logs: [`ConvertKit unsubscribe → ${email}`] };
}

async function subscriberGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = getSecret(ctx);
  const id = asString(ctx.options.id);
  if (!id) throw new Error('ConvertKit: id is required');
  const res = await apiRequest({
    service: 'ConvertKit',
    method: 'GET',
    url: `${BASE}/subscribers/${encodeURIComponent(id)}?api_secret=${encodeURIComponent(secret)}`,
  });
  return { outputs: { subscriber: res.data }, logs: [`ConvertKit subscriber get → ${id}`] };
}

async function tagAddSubscriber(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = getSecret(ctx);
  const tagId = asString(ctx.options.tagId);
  const email = asString(ctx.options.email);
  if (!tagId) throw new Error('ConvertKit: tagId is required');
  if (!email) throw new Error('ConvertKit: email is required');
  const body: Record<string, unknown> = { email, api_secret: secret };
  const firstName = asString(ctx.options.firstName);
  if (firstName) body.first_name = firstName;
  const res = await apiRequest({
    service: 'ConvertKit',
    method: 'POST',
    url: `${BASE}/tags/${encodeURIComponent(tagId)}/subscribe`,
    json: body,
  });
  return { outputs: { subscription: res.data }, logs: [`ConvertKit tag add → ${email}`] };
}

const block: ForgeBlock = {
  id: 'forge_convertkit',
  name: 'ConvertKit',
  description: 'Manage ConvertKit (Kit) subscribers, forms and tags.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'convertkit' },
  actions: [
    {
      id: 'subscriber_form_subscribe',
      label: 'Subscribe to form',
      description: 'Add a subscriber to a ConvertKit form.',
      fields: [
        { id: 'formId', label: 'Form ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'tags', label: 'Tag IDs (comma separated)', type: 'text' },
      ],
      run: subscriberFormSubscribe,
    },
    {
      id: 'subscriber_unsubscribe',
      label: 'Unsubscribe',
      description: 'Unsubscribe an email from all sequences/forms.',
      fields: [{ id: 'email', label: 'Email', type: 'text', required: true }],
      run: subscriberUnsubscribe,
    },
    {
      id: 'subscriber_get',
      label: 'Get subscriber',
      description: 'Fetch a subscriber by ID.',
      fields: [{ id: 'id', label: 'Subscriber ID', type: 'text', required: true }],
      run: subscriberGet,
    },
    {
      id: 'tag_add_subscriber',
      label: 'Add tag to subscriber',
      description: 'Tag an email address.',
      fields: [
        { id: 'tagId', label: 'Tag ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
      ],
      run: tagAddSubscriber,
    },
  ],
};

registerForgeBlock(block);
export default block;
