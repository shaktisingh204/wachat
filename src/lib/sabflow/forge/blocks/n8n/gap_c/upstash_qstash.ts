/**
 * Forge block: Upstash QStash
 *
 * `https://qstash.upstash.io/v2` — durable, at-least-once HTTP message queue.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const API = 'https://qstash.upstash.io/v2';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.token);
  if (!token) throw new Error('QStash: token is required');
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function publish(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const target = asString(ctx.options.target);
  const body = asString(ctx.options.body);
  const delay = asString(ctx.options.delay);
  const retries = asNumber(ctx.options.retries);
  if (!target) throw new Error('QStash: target is required');
  const headers: Record<string, string> = {
    ...authHeaders(ctx),
    'Content-Type': 'application/json',
  };
  if (delay) headers['Upstash-Delay'] = delay;
  if (typeof retries === 'number') headers['Upstash-Retries'] = String(retries);
  const res = await apiRequest({
    service: 'QStash',
    method: 'POST',
    url: `${API}/publish/${target}`,
    headers,
    body,
  });
  return { outputs: { message: res.data }, logs: [`QStash publish → ${target}`] };
}

async function schedule(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const target = asString(ctx.options.target);
  const cron = asString(ctx.options.cron);
  const body = asString(ctx.options.body);
  if (!target || !cron) throw new Error('QStash: target and cron are required');
  const headers: Record<string, string> = {
    ...authHeaders(ctx),
    'Content-Type': 'application/json',
    'Upstash-Cron': cron,
  };
  const res = await apiRequest({
    service: 'QStash',
    method: 'POST',
    url: `${API}/schedules/${target}`,
    headers,
    body,
  });
  return { outputs: { schedule: res.data }, logs: [`QStash schedule → ${target}`] };
}

async function listSchedules(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'QStash',
    method: 'GET',
    url: `${API}/schedules`,
    headers: authHeaders(ctx),
  });
  return { outputs: { schedules: res.data }, logs: ['QStash list schedules'] };
}

const block: ForgeBlock = {
  id: 'forge_upstash_qstash',
  name: 'Upstash QStash',
  description: 'Publish messages and create scheduled jobs on QStash.',
  iconName: 'LuSend',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'publish',
      label: 'Publish message',
      fields: [
        { id: 'token', label: 'Token', type: 'password', required: true },
        { id: 'target', label: 'Target URL or topic', type: 'text', required: true },
        { id: 'body', label: 'Body (JSON or text)', type: 'textarea' },
        { id: 'delay', label: 'Delay (e.g. 10s)', type: 'text' },
        { id: 'retries', label: 'Retries', type: 'number' },
      ],
      run: publish,
    },
    {
      id: 'schedule',
      label: 'Create schedule',
      fields: [
        { id: 'token', label: 'Token', type: 'password', required: true },
        { id: 'target', label: 'Target URL', type: 'text', required: true },
        { id: 'cron', label: 'Cron expression', type: 'text', required: true },
        { id: 'body', label: 'Body (JSON or text)', type: 'textarea' },
      ],
      run: schedule,
    },
    {
      id: 'list_schedules',
      label: 'List schedules',
      fields: [
        { id: 'token', label: 'Token', type: 'password', required: true },
      ],
      run: listSchedules,
    },
  ],
};

registerForgeBlock(block);
export default block;
