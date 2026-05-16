/**
 * Forge block: Pushcut
 *
 * Source: n8n-master/packages/nodes-base/nodes/Pushcut/Pushcut.node.ts
 *
 * Header auth: `API-Key`.
 *
 * Operations covered:
 *   - notification.send  POST  /notifications/{name}
 *   - notification.list  GET   /notifications
 *   - device.list        GET   /devices
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.pushcut.io/v1';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const k = asString(ctx.options.apiKey);
  if (!k) throw new Error('Pushcut: apiKey is required');
  return { 'API-Key': k };
}

async function notificationSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.notificationName);
  if (!name) throw new Error('Pushcut: notificationName is required');
  const body: Record<string, unknown> = {};
  const title = asString(ctx.options.title);
  if (title) body.title = title;
  const text = asString(ctx.options.text);
  if (text) body.text = text;
  const input = asString(ctx.options.input);
  if (input) body.input = input;
  const devices = asString(ctx.options.devices);
  if (devices) {
    body.devices = devices.split(',').map((d) => d.trim()).filter(Boolean);
  }
  const res = await apiRequest({
    service: 'Pushcut',
    method: 'POST',
    url: `${API}/notifications/${encodeURI(name)}`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Pushcut send → ${name}`] };
}

async function notificationList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Pushcut',
    method: 'GET',
    url: `${API}/notifications`,
    headers: authHeader(ctx),
  });
  return { outputs: { notifications: res.data }, logs: ['Pushcut notification list'] };
}

async function deviceList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Pushcut',
    method: 'GET',
    url: `${API}/devices`,
    headers: authHeader(ctx),
  });
  return { outputs: { devices: res.data }, logs: ['Pushcut device list'] };
}

const block: ForgeBlock = {
  id: 'forge_pushcut',
  name: 'Pushcut',
  description: 'Trigger Pushcut notifications and list devices.',
  iconName: 'LuBellRing',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'notification_send',
      label: 'Send notification',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'notificationName', label: 'Notification name', type: 'text', required: true },
        { id: 'title', label: 'Override title', type: 'text' },
        { id: 'text', label: 'Override text', type: 'textarea' },
        { id: 'input', label: 'Input', type: 'text' },
        { id: 'devices', label: 'Devices (comma separated)', type: 'text' },
      ],
      run: notificationSend,
    },
    {
      id: 'notification_list',
      label: 'List notifications',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
      ],
      run: notificationList,
    },
    {
      id: 'device_list',
      label: 'List devices',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
      ],
      run: deviceList,
    },
  ],
};

registerForgeBlock(block);
export default block;
