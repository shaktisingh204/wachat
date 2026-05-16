/**
 * Forge block: SIGNL4
 *
 * Source: n8n-master/packages/nodes-base/nodes/Signl4/Signl4.node.ts
 *
 * Each tenant has a `teamSecret` baked into a webhook URL:
 * https://connect.signl4.com/webhook/{teamSecret}
 *
 * Operations covered:
 *   - alert.create   POST  /{teamSecret}  (status=new)
 *   - alert.resolve  POST  /{teamSecret}  (status=resolved + externalId)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function url(ctx: ForgeActionContext): string {
  const ts = asString(ctx.options.teamSecret);
  if (!ts) throw new Error('SIGNL4: teamSecret is required');
  return `https://connect.signl4.com/webhook/${encodeURIComponent(ts)}`;
}

async function alertCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const message = asString(ctx.options.message);
  if (!message) throw new Error('SIGNL4: message is required');
  const body: Record<string, unknown> = {
    message,
    'X-S4-Status': 'new',
    'X-S4-SourceSystem': 'SabFlow',
  };
  const title = asString(ctx.options.title);
  if (title) body.title = title;
  const service = asString(ctx.options.service);
  if (service) body.service = service;
  const externalId = asString(ctx.options.externalId);
  if (externalId) body['X-S4-ExternalID'] = externalId;
  const alertingScenario = asString(ctx.options.alertingScenario);
  if (alertingScenario) body['X-S4-AlertingScenario'] = alertingScenario;
  const filtering = asString(ctx.options.filtering);
  if (filtering) body['X-S4-Filtering'] = filtering;
  const lat = asString(ctx.options.latitude);
  const lng = asString(ctx.options.longitude);
  if (lat && lng) body['X-S4-Location'] = `${lat},${lng}`;

  const res = await apiRequest({
    service: 'SIGNL4',
    method: 'POST',
    url: url(ctx),
    headers: { Accept: '*/*' },
    json: body,
  });
  return { outputs: { result: res.data }, logs: ['SIGNL4 alert created'] };
}

async function alertResolve(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const externalId = asString(ctx.options.externalId);
  if (!externalId) throw new Error('SIGNL4: externalId is required for resolve');
  const body = {
    'X-S4-ExternalID': externalId,
    'X-S4-Status': 'resolved',
    'X-S4-SourceSystem': 'SabFlow',
  };
  const res = await apiRequest({
    service: 'SIGNL4',
    method: 'POST',
    url: url(ctx),
    headers: { Accept: '*/*' },
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`SIGNL4 alert resolved → ${externalId}`] };
}

const block: ForgeBlock = {
  id: 'forge_signl4',
  name: 'SIGNL4',
  description: 'Send and resolve alerts via SIGNL4 webhook integration.',
  iconName: 'LuSiren',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'alert_create',
      label: 'Send alert',
      fields: [
        { id: 'teamSecret', label: 'Team secret', type: 'password', required: true },
        { id: 'message', label: 'Message', type: 'textarea', required: true },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'service', label: 'Service', type: 'text' },
        { id: 'externalId', label: 'External ID', type: 'text' },
        { id: 'alertingScenario', label: 'Alerting scenario', type: 'select', options: [
          { label: 'Single ACK', value: 'single_ack' },
          { label: 'Multi ACK', value: 'multi_ack' },
        ] },
        { id: 'filtering', label: 'Filtering (true/false)', type: 'text' },
        { id: 'latitude', label: 'Latitude', type: 'text' },
        { id: 'longitude', label: 'Longitude', type: 'text' },
      ],
      run: alertCreate,
    },
    {
      id: 'alert_resolve',
      label: 'Resolve alert',
      fields: [
        { id: 'teamSecret', label: 'Team secret', type: 'password', required: true },
        { id: 'externalId', label: 'External ID', type: 'text', required: true },
      ],
      run: alertResolve,
    },
  ],
};

registerForgeBlock(block);
export default block;
