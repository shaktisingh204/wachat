/**
 * Forge block: MISP
 *
 * Source: n8n-master/packages/nodes-base/nodes/Misp/Misp.node.ts
 *
 * MISP authenticates with a raw API key in the `Authorization` header (no
 * bearer prefix). Base URL is configured per-instance.
 *
 * Operations covered:
 *   - event.create        POST   /events/add
 *   - event.get           GET    /events/view/{id}
 *   - event.list          GET    /events/index
 *   - attribute.create    POST   /attributes/add/{event_id}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function base(ctx: ForgeActionContext): string {
  const raw = asString(ctx.options.baseUrl);
  if (!raw) throw new Error('MISP: baseUrl is required');
  return raw.replace(/\/+$/, '');
}

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('MISP: apiKey is required');
  return { Authorization: key, Accept: 'application/json' };
}

async function eventCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const info = asString(ctx.options.info);
  if (!info) throw new Error('MISP: info is required');
  const body: Record<string, unknown> = { info };
  const distribution = asString(ctx.options.distribution);
  const threatLevelId = asString(ctx.options.threatLevelId);
  const analysis = asString(ctx.options.analysis);
  if (distribution) body.distribution = distribution;
  if (threatLevelId) body.threat_level_id = threatLevelId;
  if (analysis) body.analysis = analysis;
  const res = await apiRequest({
    service: 'MISP',
    method: 'POST',
    url: `${base(ctx)}/events/add`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { event: res.data }, logs: [`MISP event.create → ${info}`] };
}

async function eventGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.eventId);
  if (!id) throw new Error('MISP: eventId is required');
  const res = await apiRequest({
    service: 'MISP',
    method: 'GET',
    url: `${base(ctx)}/events/view/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { event: res.data }, logs: [`MISP event.get → ${id}`] };
}

async function eventList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'MISP',
    method: 'GET',
    url: `${base(ctx)}/events/index`,
    headers: authHeader(ctx),
  });
  return { outputs: { events: res.data }, logs: ['MISP event.list'] };
}

async function attributeCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const eventId = asString(ctx.options.eventId);
  const value = asString(ctx.options.value);
  const type = asString(ctx.options.type);
  if (!eventId || !value || !type) {
    throw new Error('MISP: eventId, value and type are required');
  }
  const body: Record<string, unknown> = { value, type };
  const category = asString(ctx.options.category);
  const comment = asString(ctx.options.comment);
  if (category) body.category = category;
  if (comment) body.comment = comment;
  const res = await apiRequest({
    service: 'MISP',
    method: 'POST',
    url: `${base(ctx)}/attributes/add/${encodeURIComponent(eventId)}`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { attribute: res.data }, logs: [`MISP attribute.create → event ${eventId}`] };
}

const credFields = [
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, required: true, placeholder: 'https://misp.example.com' },
  { id: 'apiKey', label: 'API key', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_misp',
  name: 'MISP',
  description: 'Create events and attributes in a MISP threat-intel instance.',
  iconName: 'LuShield',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'event_create',
      label: 'Create event',
      description: 'Open a new MISP event.',
      fields: [
        ...credFields,
        { id: 'info', label: 'Info', type: 'text', required: true },
        { id: 'distribution', label: 'Distribution', type: 'text', placeholder: '0-3' },
        { id: 'threatLevelId', label: 'Threat level', type: 'text', placeholder: '1=high,2=med,3=low,4=undef' },
        { id: 'analysis', label: 'Analysis', type: 'text', placeholder: '0=initial,1=ongoing,2=complete' },
      ],
      run: eventCreate,
    },
    {
      id: 'event_get',
      label: 'Get event',
      description: 'Fetch a single event by id.',
      fields: [
        ...credFields,
        { id: 'eventId', label: 'Event ID', type: 'text', required: true },
      ],
      run: eventGet,
    },
    {
      id: 'event_list',
      label: 'List events',
      description: 'List events on the instance.',
      fields: [...credFields],
      run: eventList,
    },
    {
      id: 'attribute_create',
      label: 'Create attribute',
      description: 'Attach an attribute to an existing event.',
      fields: [
        ...credFields,
        { id: 'eventId', label: 'Event ID', type: 'text', required: true },
        { id: 'type', label: 'Type', type: 'text', required: true, placeholder: 'ip-src, domain, url, md5, …' },
        { id: 'value', label: 'Value', type: 'text', required: true },
        { id: 'category', label: 'Category', type: 'text' },
        { id: 'comment', label: 'Comment', type: 'textarea' },
      ],
      run: attributeCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
