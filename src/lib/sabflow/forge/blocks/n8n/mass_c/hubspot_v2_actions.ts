/**
 * Forge block: HubSpot V2 (extended actions)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Hubspot/V2/HubspotV2.node.ts
 *
 * HubSpot Private App access token (`pat-…`) passed inline.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.hubapi.com';

function headers(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('HubSpot: accessToken is required');
  return { Authorization: `Bearer ${token}` };
}

async function contactSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query);
  if (!query) throw new Error('HubSpot: query is required');
  const res = await apiRequest({
    service: 'HubSpot',
    method: 'POST',
    url: `${API}/crm/v3/objects/contacts/search`,
    headers: headers(ctx),
    json: { query, limit: 25 },
  });
  return { outputs: { result: res.data }, logs: [`HubSpot contact search → ${query}`] };
}

async function dealCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const dealname = asString(ctx.options.dealname);
  const pipeline = asString(ctx.options.pipeline);
  const dealstage = asString(ctx.options.dealstage);
  const amount = asString(ctx.options.amount);
  if (!dealname || !pipeline || !dealstage)
    throw new Error('HubSpot: dealname, pipeline and dealstage are required');
  const properties: Record<string, string> = { dealname, pipeline, dealstage };
  if (amount) properties.amount = amount;
  const res = await apiRequest({
    service: 'HubSpot',
    method: 'POST',
    url: `${API}/crm/v3/objects/deals`,
    headers: headers(ctx),
    json: { properties },
  });
  return { outputs: { deal: res.data }, logs: [`HubSpot deal create → ${dealname}`] };
}

async function ticketCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const subject = asString(ctx.options.subject);
  const hsPipeline = asString(ctx.options.hsPipeline);
  const hsPipelineStage = asString(ctx.options.hsPipelineStage);
  const content = asString(ctx.options.content);
  if (!subject || !hsPipeline || !hsPipelineStage)
    throw new Error('HubSpot: subject, hsPipeline and hsPipelineStage are required');
  const properties: Record<string, string> = {
    subject,
    hs_pipeline: hsPipeline,
    hs_pipeline_stage: hsPipelineStage,
  };
  if (content) properties.content = content;
  const res = await apiRequest({
    service: 'HubSpot',
    method: 'POST',
    url: `${API}/crm/v3/objects/tickets`,
    headers: headers(ctx),
    json: { properties },
  });
  return { outputs: { ticket: res.data }, logs: [`HubSpot ticket create → ${subject}`] };
}

async function companyAssociate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const companyId = asString(ctx.options.companyId);
  const contactId = asString(ctx.options.contactId);
  if (!companyId || !contactId) throw new Error('HubSpot: companyId and contactId are required');
  const res = await apiRequest({
    service: 'HubSpot',
    method: 'PUT',
    url: `${API}/crm/v3/objects/companies/${encodeURIComponent(companyId)}/associations/contacts/${encodeURIComponent(contactId)}/company_to_contact`,
    headers: headers(ctx),
  });
  return { outputs: { result: res.data }, logs: [`HubSpot associate → ${companyId}/${contactId}`] };
}

const block: ForgeBlock = {
  id: 'forge_hubspot_v2_actions',
  name: 'HubSpot V2 (extended)',
  description: 'HubSpot CRM ops (contact search, deal create, ticket create, associate).',
  iconName: 'LuBriefcase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'contact_search',
      label: 'Search contacts',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'query', label: 'Query', type: 'text', required: true },
      ],
      run: contactSearch,
    },
    {
      id: 'deal_create',
      label: 'Create deal',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'dealname', label: 'Deal name', type: 'text', required: true },
        { id: 'pipeline', label: 'Pipeline ID', type: 'text', required: true },
        { id: 'dealstage', label: 'Deal stage ID', type: 'text', required: true },
        { id: 'amount', label: 'Amount', type: 'number' },
      ],
      run: dealCreate,
    },
    {
      id: 'ticket_create',
      label: 'Create ticket',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'hsPipeline', label: 'Pipeline', type: 'text', required: true },
        { id: 'hsPipelineStage', label: 'Pipeline stage', type: 'text', required: true },
        { id: 'content', label: 'Content', type: 'textarea' },
      ],
      run: ticketCreate,
    },
    {
      id: 'company_associate',
      label: 'Associate company ↔ contact',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'companyId', label: 'Company ID', type: 'text', required: true },
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
      ],
      run: companyAssociate,
    },
  ],
};

registerForgeBlock(block);
export default block;
