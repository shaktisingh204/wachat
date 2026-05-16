/**
 * Forge block: Salesforce (extended actions)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Salesforce/Salesforce.node.ts
 *
 * Inline session token and instance URL. Covers SOQL, sobject upsert, describe.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function base(ctx: ForgeActionContext): string {
  const instance = asString(ctx.options.instanceUrl);
  if (!instance) throw new Error('Salesforce: instanceUrl is required');
  return `${instance.replace(/\/+$/, '')}/services/data/v59.0`;
}

function headers(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('Salesforce: accessToken is required');
  return { Authorization: `Bearer ${token}` };
}

async function soqlQuery(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const q = asString(ctx.options.q);
  if (!q) throw new Error('Salesforce: q is required');
  const res = await apiRequest({
    service: 'Salesforce',
    method: 'GET',
    url: `${base(ctx)}/query/?q=${encodeURIComponent(q)}`,
    headers: headers(ctx),
  });
  return { outputs: { result: res.data }, logs: [`Salesforce SOQL → ${q.slice(0, 60)}`] };
}

async function sobjectDescribe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sobject = asString(ctx.options.sobject);
  if (!sobject) throw new Error('Salesforce: sobject is required');
  const res = await apiRequest({
    service: 'Salesforce',
    method: 'GET',
    url: `${base(ctx)}/sobjects/${encodeURIComponent(sobject)}/describe/`,
    headers: headers(ctx),
  });
  return { outputs: { describe: res.data }, logs: [`Salesforce describe → ${sobject}`] };
}

async function sobjectUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sobject = asString(ctx.options.sobject);
  const externalIdField = asString(ctx.options.externalIdField);
  const externalIdValue = asString(ctx.options.externalIdValue);
  const dataRaw = asString(ctx.options.data);
  if (!sobject || !externalIdField || !externalIdValue || !dataRaw)
    throw new Error('Salesforce: sobject, externalIdField, externalIdValue and data are required');
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataRaw);
  } catch {
    throw new Error('Salesforce: data must be valid JSON');
  }
  const res = await apiRequest({
    service: 'Salesforce',
    method: 'PATCH',
    url: `${base(ctx)}/sobjects/${encodeURIComponent(sobject)}/${encodeURIComponent(externalIdField)}/${encodeURIComponent(externalIdValue)}`,
    headers: headers(ctx),
    json: data,
  });
  return { outputs: { result: res.data, status: res.status }, logs: [`Salesforce upsert → ${sobject}`] };
}

async function sobjectDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sobject = asString(ctx.options.sobject);
  const id = asString(ctx.options.id);
  if (!sobject || !id) throw new Error('Salesforce: sobject and id are required');
  const res = await apiRequest({
    service: 'Salesforce',
    method: 'DELETE',
    url: `${base(ctx)}/sobjects/${encodeURIComponent(sobject)}/${encodeURIComponent(id)}`,
    headers: headers(ctx),
  });
  return { outputs: { status: res.status }, logs: [`Salesforce delete → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_salesforce_ext',
  name: 'Salesforce (extended)',
  description: 'Salesforce ops (SOQL, describe, upsert, delete).',
  iconName: 'LuCloud',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'soql_query',
      label: 'Run SOQL query',
      fields: [
        { id: 'instanceUrl', label: 'Instance URL', type: 'text', required: true },
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'q', label: 'SOQL', type: 'textarea', required: true, placeholder: 'SELECT Id, Name FROM Account LIMIT 10' },
      ],
      run: soqlQuery,
    },
    {
      id: 'sobject_describe',
      label: 'Describe SObject',
      fields: [
        { id: 'instanceUrl', label: 'Instance URL', type: 'text', required: true },
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'sobject', label: 'SObject', type: 'text', required: true, placeholder: 'Account' },
      ],
      run: sobjectDescribe,
    },
    {
      id: 'sobject_upsert',
      label: 'Upsert SObject',
      fields: [
        { id: 'instanceUrl', label: 'Instance URL', type: 'text', required: true },
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'sobject', label: 'SObject', type: 'text', required: true },
        { id: 'externalIdField', label: 'External ID field', type: 'text', required: true },
        { id: 'externalIdValue', label: 'External ID value', type: 'text', required: true },
        { id: 'data', label: 'Fields (JSON)', type: 'json', required: true },
      ],
      run: sobjectUpsert,
    },
    {
      id: 'sobject_delete',
      label: 'Delete SObject',
      fields: [
        { id: 'instanceUrl', label: 'Instance URL', type: 'text', required: true },
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'sobject', label: 'SObject', type: 'text', required: true },
        { id: 'id', label: 'Record ID', type: 'text', required: true },
      ],
      run: sobjectDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
