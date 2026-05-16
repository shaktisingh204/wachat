/**
 * Forge block: UptimeRobot
 *
 * Source: n8n-master/packages/nodes-base/nodes/UptimeRobot/UptimeRobot.node.ts
 * Auth: form-urlencoded `api_key` — inline as `password` field.
 *
 * Operations covered:
 *   - monitor.list           POST /v2/getMonitors
 *   - monitor.get            POST /v2/getMonitors (filter by id)
 *   - monitor.create         POST /v2/newMonitor
 *   - alert-contact.list     POST /v2/getAlertContacts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.uptimerobot.com/v2';

function buildBody(ctx: ForgeActionContext, extras: Record<string, string | undefined>): string {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('UptimeRobot: apiKey is required');
  const params = new URLSearchParams();
  params.set('api_key', apiKey);
  params.set('format', 'json');
  for (const [k, v] of Object.entries(extras)) {
    if (v != null && v !== '') params.set(k, v);
  }
  return params.toString();
}

async function form(ctx: ForgeActionContext, path: string, extras: Record<string, string | undefined>, label: string, outputKey: string): Promise<ForgeActionResult> {
  const body = buildBody(ctx, extras);
  const res = await apiRequest({
    service: 'UptimeRobot',
    method: 'POST',
    url: `${API}${path}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return { outputs: { [outputKey]: res.data }, logs: [label] };
}

async function monitorList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return form(ctx, '/getMonitors', {
    search: asString(ctx.options.search) || undefined,
    statuses: asString(ctx.options.statuses) || undefined,
    limit: asString(ctx.options.limit) || undefined,
    offset: asString(ctx.options.offset) || undefined,
  }, 'UptimeRobot monitor.list', 'monitors');
}

async function monitorGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const monitorId = asString(ctx.options.monitorId);
  if (!monitorId) throw new Error('UptimeRobot: monitorId is required');
  return form(ctx, '/getMonitors', { monitors: monitorId }, `UptimeRobot monitor.get → ${monitorId}`, 'monitor');
}

async function monitorCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const friendlyName = asString(ctx.options.friendlyName);
  const url = asString(ctx.options.url);
  if (!friendlyName) throw new Error('UptimeRobot: friendlyName is required');
  if (!url) throw new Error('UptimeRobot: url is required');
  return form(ctx, '/newMonitor', {
    friendly_name: friendlyName,
    url,
    type: asString(ctx.options.type) || '1',
    interval: asString(ctx.options.interval) || undefined,
  }, `UptimeRobot monitor.create → ${friendlyName}`, 'monitor');
}

async function alertContactList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return form(ctx, '/getAlertContacts', {
    limit: asString(ctx.options.limit) || undefined,
    offset: asString(ctx.options.offset) || undefined,
  }, 'UptimeRobot alert-contact.list', 'alertContacts');
}

const MONITOR_TYPE_OPTIONS = [
  { label: 'HTTP(S)', value: '1' },
  { label: 'Keyword', value: '2' },
  { label: 'Ping', value: '3' },
  { label: 'Port', value: '4' },
  { label: 'Heartbeat', value: '5' },
];

const block: ForgeBlock = {
  id: 'forge_uptimerobot',
  name: 'UptimeRobot',
  description: 'Manage UptimeRobot monitors and alert contacts.',
  iconName: 'LuActivity',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'monitor_list',
      label: 'List monitors',
      description: 'List monitors with optional filters.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'search', label: 'Search', type: 'text' },
        { id: 'statuses', label: 'Status filter (e.g. 2-9)', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'offset', label: 'Offset', type: 'number' },
      ],
      run: monitorList,
    },
    {
      id: 'monitor_get',
      label: 'Get monitor',
      description: 'Fetch a single monitor by id.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'monitorId', label: 'Monitor id', type: 'text', required: true },
      ],
      run: monitorGet,
    },
    {
      id: 'monitor_create',
      label: 'Create monitor',
      description: 'Create a new monitor.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'friendlyName', label: 'Friendly name', type: 'text', required: true },
        { id: 'url', label: 'URL or host', type: 'text', required: true },
        { id: 'type', label: 'Type', type: 'select', options: MONITOR_TYPE_OPTIONS, defaultValue: '1' },
        { id: 'interval', label: 'Interval (seconds)', type: 'number' },
      ],
      run: monitorCreate,
    },
    {
      id: 'alert_contact_list',
      label: 'List alert contacts',
      description: 'List configured alert contacts.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'offset', label: 'Offset', type: 'number' },
      ],
      run: alertContactList,
    },
  ],
};

registerForgeBlock(block);
export default block;
