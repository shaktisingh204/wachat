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
 *   - tag.removeSubscriber       POST  /tags/{tagId}/unsubscribe
 *   - tag.create                 POST  /tags                       (single or comma-separated names)
 *   - tag.getAll                 GET   /tags
 *   - form.getAll                GET   /forms
 *   - sequence.addSubscriber     POST  /sequences/{sequenceId}/subscribe
 *   - sequence.getAll            GET   /sequences
 *   - customField.create         POST  /custom_fields              (single or comma-separated labels)
 *   - customField.get            GET   /custom_fields/{id}
 *   - customField.getAll         GET   /custom_fields
 *   - customField.update         PUT   /custom_fields/{id}
 *   - customField.delete         DELETE /custom_fields/{id}
 *
 * Out of scope for the first port:
 *   - LoadOptions for forms/tags/sequences
 *   - Broadcasts
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

async function tagRemoveSubscriber(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = getSecret(ctx);
  const tagId = asString(ctx.options.tagId);
  const email = asString(ctx.options.email);
  if (!tagId) throw new Error('ConvertKit: tagId is required');
  if (!email) throw new Error('ConvertKit: email is required');
  const res = await apiRequest({
    service: 'ConvertKit',
    method: 'POST',
    url: `${BASE}/tags/${encodeURIComponent(tagId)}/unsubscribe`,
    json: { email, api_secret: secret },
  });
  return { outputs: { result: res.data, success: true }, logs: [`ConvertKit tag remove → ${email}`] };
}

async function tagCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = getSecret(ctx);
  const namesRaw = asString(ctx.options.name);
  if (!namesRaw) throw new Error('ConvertKit: name(s) required');
  const tag = namesRaw.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ name }));
  const res = await apiRequest({
    service: 'ConvertKit',
    method: 'POST',
    url: `${BASE}/tags`,
    json: { tag, api_secret: secret },
  });
  return { outputs: { result: res.data }, logs: [`ConvertKit tag create → ${tag.length} tag(s)`] };
}

async function tagGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = getSecret(ctx);
  const res = await apiRequest({
    service: 'ConvertKit',
    method: 'GET',
    url: `${BASE}/tags?api_secret=${encodeURIComponent(secret)}`,
  });
  const body = res.data as { tags?: unknown[] } | null;
  const tags = body?.tags ?? [];
  return { outputs: { tags, count: Array.isArray(tags) ? tags.length : 0 }, logs: ['ConvertKit tag list'] };
}

async function formGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = getSecret(ctx);
  const res = await apiRequest({
    service: 'ConvertKit',
    method: 'GET',
    url: `${BASE}/forms?api_secret=${encodeURIComponent(secret)}`,
  });
  const body = res.data as { forms?: unknown[] } | null;
  const forms = body?.forms ?? [];
  return { outputs: { forms, count: Array.isArray(forms) ? forms.length : 0 }, logs: ['ConvertKit form list'] };
}

async function sequenceAddSubscriber(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = getSecret(ctx);
  const sequenceId = asString(ctx.options.sequenceId);
  const email = asString(ctx.options.email);
  if (!sequenceId) throw new Error('ConvertKit: sequenceId is required');
  if (!email) throw new Error('ConvertKit: email is required');
  const body: Record<string, unknown> = { email, api_secret: secret };
  const firstName = asString(ctx.options.firstName);
  if (firstName) body.first_name = firstName;
  const res = await apiRequest({
    service: 'ConvertKit',
    method: 'POST',
    url: `${BASE}/sequences/${encodeURIComponent(sequenceId)}/subscribe`,
    json: body,
  });
  return { outputs: { subscription: res.data }, logs: [`ConvertKit sequence add → ${email}`] };
}

async function sequenceGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = getSecret(ctx);
  const res = await apiRequest({
    service: 'ConvertKit',
    method: 'GET',
    url: `${BASE}/sequences?api_secret=${encodeURIComponent(secret)}`,
  });
  // ConvertKit calls them "courses" in the response payload for legacy reasons.
  const body = res.data as { courses?: unknown[] } | null;
  const sequences = body?.courses ?? [];
  return {
    outputs: { sequences, count: Array.isArray(sequences) ? sequences.length : 0 },
    logs: ['ConvertKit sequence list'],
  };
}

async function customFieldCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = getSecret(ctx);
  const labelsRaw = asString(ctx.options.label);
  if (!labelsRaw) throw new Error('ConvertKit: label is required');
  const label = labelsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  const res = await apiRequest({
    service: 'ConvertKit',
    method: 'POST',
    url: `${BASE}/custom_fields`,
    json: { label, api_secret: secret },
  });
  return { outputs: { result: res.data }, logs: [`ConvertKit custom field create → ${label.length}`] };
}

async function customFieldGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = getSecret(ctx);
  const id = asString(ctx.options.id);
  if (!id) throw new Error('ConvertKit: id is required');
  const res = await apiRequest({
    service: 'ConvertKit',
    method: 'GET',
    url: `${BASE}/custom_fields/${encodeURIComponent(id)}?api_secret=${encodeURIComponent(secret)}`,
  });
  return { outputs: { customField: res.data }, logs: [`ConvertKit custom field get → ${id}`] };
}

async function customFieldGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = getSecret(ctx);
  const res = await apiRequest({
    service: 'ConvertKit',
    method: 'GET',
    url: `${BASE}/custom_fields?api_secret=${encodeURIComponent(secret)}`,
  });
  const body = res.data as { custom_fields?: unknown[] } | null;
  const customFields = body?.custom_fields ?? [];
  return {
    outputs: { customFields, count: Array.isArray(customFields) ? customFields.length : 0 },
    logs: ['ConvertKit custom field list'],
  };
}

async function customFieldUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = getSecret(ctx);
  const id = asString(ctx.options.id);
  const label = asString(ctx.options.label);
  if (!id) throw new Error('ConvertKit: id is required');
  if (!label) throw new Error('ConvertKit: label is required');
  const res = await apiRequest({
    service: 'ConvertKit',
    method: 'PUT',
    url: `${BASE}/custom_fields/${encodeURIComponent(id)}`,
    json: { label, api_secret: secret },
  });
  return { outputs: { result: res.data, success: true }, logs: [`ConvertKit custom field update → ${id}`] };
}

async function customFieldDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const secret = getSecret(ctx);
  const id = asString(ctx.options.id);
  if (!id) throw new Error('ConvertKit: id is required');
  await apiRequest({
    service: 'ConvertKit',
    method: 'DELETE',
    url: `${BASE}/custom_fields/${encodeURIComponent(id)}?api_secret=${encodeURIComponent(secret)}`,
  });
  return { outputs: { success: true, id }, logs: [`ConvertKit custom field delete → ${id}`] };
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
    {
      id: 'tag_remove_subscriber',
      label: 'Remove tag from subscriber',
      description: 'Untag an email address.',
      fields: [
        { id: 'tagId', label: 'Tag ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
      ],
      run: tagRemoveSubscriber,
    },
    {
      id: 'tag_create',
      label: 'Create tag(s)',
      description: 'Create one or more tags (comma-separated names).',
      fields: [{ id: 'name', label: 'Tag name(s) (comma separated)', type: 'text', required: true }],
      run: tagCreate,
    },
    {
      id: 'tag_get_all',
      label: 'List tags',
      description: 'List all tags.',
      fields: [],
      run: tagGetAll,
    },
    {
      id: 'form_get_all',
      label: 'List forms',
      description: 'List all forms.',
      fields: [],
      run: formGetAll,
    },
    {
      id: 'sequence_add_subscriber',
      label: 'Add subscriber to sequence',
      description: 'Subscribe an email to a sequence.',
      fields: [
        { id: 'sequenceId', label: 'Sequence ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
      ],
      run: sequenceAddSubscriber,
    },
    {
      id: 'sequence_get_all',
      label: 'List sequences',
      description: 'List all sequences.',
      fields: [],
      run: sequenceGetAll,
    },
    {
      id: 'custom_field_create',
      label: 'Create custom field(s)',
      description: 'Create one or more custom fields (comma-separated labels).',
      fields: [{ id: 'label', label: 'Label(s) (comma separated)', type: 'text', required: true }],
      run: customFieldCreate,
    },
    {
      id: 'custom_field_get',
      label: 'Get custom field',
      description: 'Fetch a custom field by ID.',
      fields: [{ id: 'id', label: 'Custom field ID', type: 'text', required: true }],
      run: customFieldGet,
    },
    {
      id: 'custom_field_get_all',
      label: 'List custom fields',
      description: 'List all custom fields.',
      fields: [],
      run: customFieldGetAll,
    },
    {
      id: 'custom_field_update',
      label: 'Update custom field',
      description: 'Rename a custom field.',
      fields: [
        { id: 'id', label: 'Custom field ID', type: 'text', required: true },
        { id: 'label', label: 'New label', type: 'text', required: true },
      ],
      run: customFieldUpdate,
    },
    {
      id: 'custom_field_delete',
      label: 'Delete custom field',
      description: 'Delete a custom field by ID.',
      fields: [{ id: 'id', label: 'Custom field ID', type: 'text', required: true }],
      run: customFieldDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
