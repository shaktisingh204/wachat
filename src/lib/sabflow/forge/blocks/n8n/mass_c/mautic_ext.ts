/**
 * Forge block: Mautic (extended actions)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mautic/Mautic.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function base(ctx: ForgeActionContext): string {
  const url = asString(ctx.options.instanceUrl);
  if (!url) throw new Error('Mautic: instanceUrl is required');
  return `${url.replace(/\/+$/, '')}/api`;
}

function headers(ctx: ForgeActionContext): Record<string, string> {
  const username = asString(ctx.options.username);
  const password = asString(ctx.options.password);
  if (!username || !password) throw new Error('Mautic: username and password are required');
  return { Authorization: `Basic ${btoa(`${username}:${password}`)}` };
}

async function contactAddToSegment(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const contactId = asString(ctx.options.contactId);
  const segmentId = asString(ctx.options.segmentId);
  if (!contactId || !segmentId) throw new Error('Mautic: contactId and segmentId are required');
  const res = await apiRequest({
    service: 'Mautic',
    method: 'POST',
    url: `${base(ctx)}/segments/${encodeURIComponent(segmentId)}/contact/${encodeURIComponent(contactId)}/add`,
    headers: headers(ctx),
  });
  return { outputs: { result: res.data }, logs: [`Mautic segment add → ${contactId}`] };
}

async function contactRemoveFromSegment(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const contactId = asString(ctx.options.contactId);
  const segmentId = asString(ctx.options.segmentId);
  if (!contactId || !segmentId) throw new Error('Mautic: contactId and segmentId are required');
  const res = await apiRequest({
    service: 'Mautic',
    method: 'POST',
    url: `${base(ctx)}/segments/${encodeURIComponent(segmentId)}/contact/${encodeURIComponent(contactId)}/remove`,
    headers: headers(ctx),
  });
  return { outputs: { result: res.data }, logs: [`Mautic segment remove → ${contactId}`] };
}

async function campaignContactAdd(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const contactId = asString(ctx.options.contactId);
  const campaignId = asString(ctx.options.campaignId);
  if (!contactId || !campaignId) throw new Error('Mautic: contactId and campaignId are required');
  const res = await apiRequest({
    service: 'Mautic',
    method: 'POST',
    url: `${base(ctx)}/campaigns/${encodeURIComponent(campaignId)}/contact/${encodeURIComponent(contactId)}/add`,
    headers: headers(ctx),
  });
  return { outputs: { result: res.data }, logs: [`Mautic campaign add → ${contactId}`] };
}

async function segmentsList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Mautic',
    method: 'GET',
    url: `${base(ctx)}/segments`,
    headers: headers(ctx),
  });
  return { outputs: { segments: res.data }, logs: ['Mautic segments list'] };
}

const block: ForgeBlock = {
  id: 'forge_mautic_ext',
  name: 'Mautic (extended)',
  description: 'Mautic ops (add/remove from segment, add to campaign, list segments).',
  iconName: 'LuTrendingUp',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'contact_segment_add',
      label: 'Add contact to segment',
      fields: [
        { id: 'instanceUrl', label: 'Instance URL', type: 'text', required: true },
        { id: 'username', label: 'Username', type: 'text', required: true },
        { id: 'password', label: 'Password', type: 'password', required: true },
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'segmentId', label: 'Segment ID', type: 'text', required: true },
      ],
      run: contactAddToSegment,
    },
    {
      id: 'contact_segment_remove',
      label: 'Remove contact from segment',
      fields: [
        { id: 'instanceUrl', label: 'Instance URL', type: 'text', required: true },
        { id: 'username', label: 'Username', type: 'text', required: true },
        { id: 'password', label: 'Password', type: 'password', required: true },
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'segmentId', label: 'Segment ID', type: 'text', required: true },
      ],
      run: contactRemoveFromSegment,
    },
    {
      id: 'campaign_contact_add',
      label: 'Add contact to campaign',
      fields: [
        { id: 'instanceUrl', label: 'Instance URL', type: 'text', required: true },
        { id: 'username', label: 'Username', type: 'text', required: true },
        { id: 'password', label: 'Password', type: 'password', required: true },
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'campaignId', label: 'Campaign ID', type: 'text', required: true },
      ],
      run: campaignContactAdd,
    },
    {
      id: 'segments_list',
      label: 'List segments',
      fields: [
        { id: 'instanceUrl', label: 'Instance URL', type: 'text', required: true },
        { id: 'username', label: 'Username', type: 'text', required: true },
        { id: 'password', label: 'Password', type: 'password', required: true },
      ],
      run: segmentsList,
    },
  ],
};

registerForgeBlock(block);
export default block;
