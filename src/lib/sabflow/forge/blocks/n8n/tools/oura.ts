/**
 * Forge block: Oura
 *
 * Source: n8n-master/packages/nodes-base/nodes/Oura/Oura.node.ts
 *
 * Oura personal access token passed inline as a `password` field.
 *
 * Operations covered (Oura API v2):
 *   - profile.me              GET /usercollection/personal_info
 *   - sleep.list              GET /usercollection/sleep
 *   - readiness.list          GET /usercollection/daily_readiness
 *   - activity.list           GET /usercollection/daily_activity
 *   - heartrate.list          GET /usercollection/heartrate
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.ouraring.com/v2';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('Oura: accessToken is required');
  return { Authorization: `Bearer ${token}` };
}

function rangeParams(ctx: ForgeActionContext): URLSearchParams {
  const p = new URLSearchParams();
  const start = asString(ctx.options.startDate);
  const end = asString(ctx.options.endDate);
  const nextToken = asString(ctx.options.nextToken);
  if (start) p.set('start_date', start);
  if (end) p.set('end_date', end);
  if (nextToken) p.set('next_token', nextToken);
  return p;
}

async function profileMe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Oura',
    method: 'GET',
    url: `${API}/usercollection/personal_info`,
    headers: authHeader(ctx),
  });
  return { outputs: { profile: res.data }, logs: ['Oura profile me'] };
}

async function sleepList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = rangeParams(ctx);
  const res = await apiRequest({
    service: 'Oura',
    method: 'GET',
    url: `${API}/usercollection/sleep${params.toString() ? `?${params.toString()}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { sleep: res.data }, logs: ['Oura sleep list'] };
}

async function readinessList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = rangeParams(ctx);
  const res = await apiRequest({
    service: 'Oura',
    method: 'GET',
    url: `${API}/usercollection/daily_readiness${params.toString() ? `?${params.toString()}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { readiness: res.data }, logs: ['Oura readiness list'] };
}

async function activityList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = rangeParams(ctx);
  const res = await apiRequest({
    service: 'Oura',
    method: 'GET',
    url: `${API}/usercollection/daily_activity${params.toString() ? `?${params.toString()}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { activity: res.data }, logs: ['Oura activity list'] };
}

async function heartrateList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const p = new URLSearchParams();
  const start = asString(ctx.options.startDatetime);
  const end = asString(ctx.options.endDatetime);
  const nextToken = asString(ctx.options.nextToken);
  if (start) p.set('start_datetime', start);
  if (end) p.set('end_datetime', end);
  if (nextToken) p.set('next_token', nextToken);
  const res = await apiRequest({
    service: 'Oura',
    method: 'GET',
    url: `${API}/usercollection/heartrate${p.toString() ? `?${p.toString()}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { heartrate: res.data }, logs: ['Oura heartrate list'] };
}

const block: ForgeBlock = {
  id: 'forge_oura',
  name: 'Oura',
  description: 'Fetch sleep, readiness, activity and profile data from the Oura API.',
  iconName: 'LuCircleDot',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'profile_me',
      label: 'Get profile (me)',
      description: 'Fetch the personal info for the authenticated user.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
      ],
      run: profileMe,
    },
    {
      id: 'sleep_list',
      label: 'List sleep',
      description: 'Fetch sleep entries in a date range.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'startDate', label: 'Start date (YYYY-MM-DD)', type: 'text' },
        { id: 'endDate', label: 'End date (YYYY-MM-DD)', type: 'text' },
        { id: 'nextToken', label: 'Next token', type: 'text' },
      ],
      run: sleepList,
    },
    {
      id: 'readiness_list',
      label: 'List readiness',
      description: 'Fetch daily readiness summaries in a date range.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'startDate', label: 'Start date (YYYY-MM-DD)', type: 'text' },
        { id: 'endDate', label: 'End date (YYYY-MM-DD)', type: 'text' },
        { id: 'nextToken', label: 'Next token', type: 'text' },
      ],
      run: readinessList,
    },
    {
      id: 'activity_list',
      label: 'List daily activity',
      description: 'Fetch daily activity summaries in a date range.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'startDate', label: 'Start date (YYYY-MM-DD)', type: 'text' },
        { id: 'endDate', label: 'End date (YYYY-MM-DD)', type: 'text' },
        { id: 'nextToken', label: 'Next token', type: 'text' },
      ],
      run: activityList,
    },
    {
      id: 'heartrate_list',
      label: 'List heart rate',
      description: 'Fetch heart-rate samples in a datetime range.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'startDatetime', label: 'Start datetime (ISO)', type: 'text' },
        { id: 'endDatetime', label: 'End datetime (ISO)', type: 'text' },
        { id: 'nextToken', label: 'Next token', type: 'text' },
      ],
      run: heartrateList,
    },
  ],
};

registerForgeBlock(block);
export default block;
