/**
 * Forge block: Emelia
 *
 * Source: n8n-master/packages/nodes-base/nodes/Emelia/Emelia.node.ts
 *
 * Auth: `Authorization: <apiKey>` (no `Bearer ` prefix).
 * Transport: single GraphQL endpoint at https://graphql.emelia.io/graphql.
 *
 * Operations covered:
 *   - campaign.list           query all_campaigns
 *   - campaign.create         mutation createCampaign
 *   - campaign.start          mutation startCampaign
 *   - campaign.pause          mutation pauseCampaign
 *   - campaign.addContact     mutation AddContactToCampaignHook
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const ENDPOINT = 'https://graphql.emelia.io/graphql';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Emelia: apiKey is required');
  return { Authorization: apiKey, Accept: 'application/json' };
}

async function graphql(
  ctx: ForgeActionContext,
  body: { query: string; operationName?: string; variables?: Record<string, unknown> },
): Promise<{ data?: Record<string, unknown>; errors?: unknown }> {
  const res = await apiRequest({
    service: 'Emelia',
    method: 'POST',
    url: ENDPOINT,
    headers: authHeaders(ctx),
    json: body,
  });
  const payload = res.data as { data?: Record<string, unknown>; errors?: unknown } | string;
  if (typeof payload === 'string') throw new Error(`Emelia: unexpected response: ${payload}`);
  if (payload.errors) {
    throw new Error(`Emelia GraphQL error: ${JSON.stringify(payload.errors)}`);
  }
  return payload;
}

async function campaignList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const result = await graphql(ctx, {
    operationName: 'all_campaigns',
    query: `query all_campaigns { all_campaigns { _id name status createdAt stats { mailsSent } } }`,
  });
  return { outputs: { campaigns: result.data?.all_campaigns }, logs: ['Emelia campaign list'] };
}

async function campaignCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Emelia: name is required');
  const result = await graphql(ctx, {
    operationName: 'createCampaign',
    query: `mutation createCampaign($name: String!) {
      createCampaign(name: $name) { _id name status createdAt }
    }`,
    variables: { name },
  });
  return { outputs: { campaign: result.data?.createCampaign }, logs: [`Emelia campaign create → ${name}`] };
}

async function campaignStart(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.campaignId);
  if (!id) throw new Error('Emelia: campaignId is required');
  await graphql(ctx, {
    operationName: 'startCampaign',
    query: `mutation startCampaign($id: ID!) { startCampaign(id: $id) }`,
    variables: { id },
  });
  return { outputs: { success: true }, logs: [`Emelia campaign start → ${id}`] };
}

async function campaignPause(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.campaignId);
  if (!id) throw new Error('Emelia: campaignId is required');
  await graphql(ctx, {
    operationName: 'pauseCampaign',
    query: `mutation pauseCampaign($id: ID!) { pauseCampaign(id: $id) }`,
    variables: { id },
  });
  return { outputs: { success: true }, logs: [`Emelia campaign pause → ${id}`] };
}

async function campaignAddContact(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.campaignId);
  const email = asString(ctx.options.email);
  if (!id) throw new Error('Emelia: campaignId is required');
  if (!email) throw new Error('Emelia: email is required');
  const contact: Record<string, unknown> = { email };
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  if (firstName) contact.firstName = firstName;
  if (lastName) contact.lastName = lastName;
  const result = await graphql(ctx, {
    operationName: 'AddContactToCampaignHook',
    query: `mutation AddContactToCampaignHook($id: ID!, $contact: JSON!) {
      addContactToCampaignHook(id: $id, contact: $contact)
    }`,
    variables: { id, contact },
  });
  return {
    outputs: { contactId: result.data?.addContactToCampaignHook },
    logs: [`Emelia campaign add contact → ${email}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_emelia',
  name: 'Emelia',
  description: 'Run Emelia outbound campaigns and add contacts.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'campaign_list',
      label: 'List campaigns',
      description: 'List all Emelia campaigns.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
      ],
      run: campaignList,
    },
    {
      id: 'campaign_create',
      label: 'Create campaign',
      description: 'Create a new campaign.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'name', label: 'Campaign name', type: 'text', required: true },
      ],
      run: campaignCreate,
    },
    {
      id: 'campaign_start',
      label: 'Start campaign',
      description: 'Start a paused or draft campaign.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'campaignId', label: 'Campaign ID', type: 'text', required: true },
      ],
      run: campaignStart,
    },
    {
      id: 'campaign_pause',
      label: 'Pause campaign',
      description: 'Pause a running campaign.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'campaignId', label: 'Campaign ID', type: 'text', required: true },
      ],
      run: campaignPause,
    },
    {
      id: 'campaign_add_contact',
      label: 'Add contact to campaign',
      description: 'Add a contact to an existing campaign.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'campaignId', label: 'Campaign ID', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
      ],
      run: campaignAddContact,
    },
  ],
};

registerForgeBlock(block);
export default block;
