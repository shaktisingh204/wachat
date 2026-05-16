/**
 * Forge block: Beeminder
 *
 * Source: n8n-master/packages/nodes-base/nodes/Beeminder/Beeminder.node.ts
 *
 * Auth: `auth_token` query param (inline password field).
 *
 * Operations covered:
 *   - datapoint.create   POST   /users/me/goals/{goal}/datapoints.json
 *   - datapoint.list     GET    /users/me/goals/{goal}/datapoints.json
 *   - datapoint.update   PUT    /users/me/goals/{goal}/datapoints/{id}.json
 *   - goal.list          GET    /users/me/goals.json
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://www.beeminder.com/api/v1';

function tokenParam(ctx: ForgeActionContext): string {
  const token = asString(ctx.options.authToken);
  if (!token) throw new Error('Beeminder: authToken is required');
  return `auth_token=${encodeURIComponent(token)}`;
}

async function datapointCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const goal = asString(ctx.options.goal);
  const value = asString(ctx.options.value);
  if (!goal) throw new Error('Beeminder: goal is required');
  if (!value) throw new Error('Beeminder: value is required');
  const params = new URLSearchParams({ value });
  const comment = asString(ctx.options.comment);
  const timestamp = asString(ctx.options.timestamp);
  if (comment) params.set('comment', comment);
  if (timestamp) params.set('timestamp', timestamp);
  const res = await apiRequest({
    service: 'Beeminder',
    method: 'POST',
    url: `${API}/users/me/goals/${encodeURIComponent(goal)}/datapoints.json?${tokenParam(ctx)}&${params.toString()}`,
  });
  return { outputs: { datapoint: res.data }, logs: [`Beeminder datapoint create → ${goal}`] };
}

async function datapointList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const goal = asString(ctx.options.goal);
  if (!goal) throw new Error('Beeminder: goal is required');
  const params = new URLSearchParams();
  const count = asString(ctx.options.count);
  if (count) params.set('count', count);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Beeminder',
    method: 'GET',
    url: `${API}/users/me/goals/${encodeURIComponent(goal)}/datapoints.json?${tokenParam(ctx)}${qs ? `&${qs}` : ''}`,
  });
  return { outputs: { datapoints: res.data }, logs: [`Beeminder datapoint list → ${goal}`] };
}

async function datapointUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const goal = asString(ctx.options.goal);
  const id = asString(ctx.options.datapointId);
  if (!goal) throw new Error('Beeminder: goal is required');
  if (!id) throw new Error('Beeminder: datapointId is required');
  const params = new URLSearchParams();
  const value = asString(ctx.options.value);
  const comment = asString(ctx.options.comment);
  const timestamp = asString(ctx.options.timestamp);
  if (value) params.set('value', value);
  if (comment) params.set('comment', comment);
  if (timestamp) params.set('timestamp', timestamp);
  const res = await apiRequest({
    service: 'Beeminder',
    method: 'PUT',
    url: `${API}/users/me/goals/${encodeURIComponent(goal)}/datapoints/${encodeURIComponent(id)}.json?${tokenParam(ctx)}&${params.toString()}`,
  });
  return { outputs: { datapoint: res.data }, logs: [`Beeminder datapoint update → ${id}`] };
}

async function goalList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Beeminder',
    method: 'GET',
    url: `${API}/users/me/goals.json?${tokenParam(ctx)}`,
  });
  return { outputs: { goals: res.data }, logs: ['Beeminder goal list'] };
}

const block: ForgeBlock = {
  id: 'forge_beeminder',
  name: 'Beeminder',
  description: 'Create datapoints and list goals in Beeminder.',
  iconName: 'LuTarget',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'datapoint_create',
      label: 'Create datapoint',
      description: 'Add a datapoint to a goal.',
      fields: [
        { id: 'authToken', label: 'Auth token', type: 'password', required: true },
        { id: 'goal', label: 'Goal slug', type: 'text', required: true },
        { id: 'value', label: 'Value', type: 'text', required: true },
        { id: 'comment', label: 'Comment', type: 'text' },
        { id: 'timestamp', label: 'Timestamp (unix seconds)', type: 'text' },
      ],
      run: datapointCreate,
    },
    {
      id: 'datapoint_list',
      label: 'List datapoints',
      description: 'List datapoints for a goal.',
      fields: [
        { id: 'authToken', label: 'Auth token', type: 'password', required: true },
        { id: 'goal', label: 'Goal slug', type: 'text', required: true },
        { id: 'count', label: 'Count', type: 'number' },
      ],
      run: datapointList,
    },
    {
      id: 'datapoint_update',
      label: 'Update datapoint',
      description: 'Update an existing datapoint.',
      fields: [
        { id: 'authToken', label: 'Auth token', type: 'password', required: true },
        { id: 'goal', label: 'Goal slug', type: 'text', required: true },
        { id: 'datapointId', label: 'Datapoint ID', type: 'text', required: true },
        { id: 'value', label: 'Value', type: 'text' },
        { id: 'comment', label: 'Comment', type: 'text' },
        { id: 'timestamp', label: 'Timestamp (unix seconds)', type: 'text' },
      ],
      run: datapointUpdate,
    },
    {
      id: 'goal_list',
      label: 'List goals',
      description: 'List the authenticated user\'s goals.',
      fields: [
        { id: 'authToken', label: 'Auth token', type: 'password', required: true },
      ],
      run: goalList,
    },
  ],
};

registerForgeBlock(block);
export default block;
