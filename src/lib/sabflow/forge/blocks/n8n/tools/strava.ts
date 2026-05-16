/**
 * Forge block: Strava
 *
 * Source: n8n-master/packages/nodes-base/nodes/Strava/Strava.node.ts
 *
 * Strava uses OAuth2 — the user pastes their access token inline as a
 * `password` field (Wave 12 policy; no new credential type added yet).
 *
 * Operations covered:
 *   - athlete.me           GET /athlete
 *   - activities.list      GET /athlete/activities
 *   - activity.get         GET /activities/{id}
 *   - activity.kudoers     GET /activities/{id}/kudos
 *   - activity.update      PUT /activities/{id}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://www.strava.com/api/v3';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.apiKey);
  if (!token) throw new Error('Strava: access token (apiKey) is required');
  return { Authorization: `Bearer ${token}` };
}

async function athleteMe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Strava',
    method: 'GET',
    url: `${API}/athlete`,
    headers: authHeader(ctx),
  });
  return {
    outputs: { athlete: res.data },
    logs: ['Strava athlete me'],
  };
}

async function activitiesList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const perPage = asString(ctx.options.perPage);
  const page = asString(ctx.options.page);
  const after = asString(ctx.options.after);
  const before = asString(ctx.options.before);
  if (perPage) params.set('per_page', perPage);
  if (page) params.set('page', page);
  if (after) params.set('after', after);
  if (before) params.set('before', before);
  const res = await apiRequest({
    service: 'Strava',
    method: 'GET',
    url: `${API}/athlete/activities${params.toString() ? `?${params.toString()}` : ''}`,
    headers: authHeader(ctx),
  });
  return {
    outputs: { activities: res.data },
    logs: ['Strava activities list'],
  };
}

async function activityGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.activityId);
  if (!id) throw new Error('Strava: activityId is required');
  const includeAll = asString(ctx.options.includeAllEfforts);
  const params = new URLSearchParams();
  if (includeAll) params.set('include_all_efforts', includeAll);
  const res = await apiRequest({
    service: 'Strava',
    method: 'GET',
    url: `${API}/activities/${encodeURIComponent(id)}${
      params.toString() ? `?${params.toString()}` : ''
    }`,
    headers: authHeader(ctx),
  });
  return {
    outputs: { activity: res.data },
    logs: [`Strava activity get → ${id}`],
  };
}

async function activityKudoers(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.activityId);
  if (!id) throw new Error('Strava: activityId is required');
  const res = await apiRequest({
    service: 'Strava',
    method: 'GET',
    url: `${API}/activities/${encodeURIComponent(id)}/kudos`,
    headers: authHeader(ctx),
  });
  return {
    outputs: { kudoers: res.data },
    logs: [`Strava activity kudoers → ${id}`],
  };
}

async function activityUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.activityId);
  if (!id) throw new Error('Strava: activityId is required');
  const body: Record<string, unknown> = {};
  const name = asString(ctx.options.name);
  const description = asString(ctx.options.description);
  const sportType = asString(ctx.options.sportType);
  const commute = asString(ctx.options.commute);
  const trainer = asString(ctx.options.trainer);
  if (name) body.name = name;
  if (description) body.description = description;
  if (sportType) body.sport_type = sportType;
  if (commute) body.commute = commute === 'true';
  if (trainer) body.trainer = trainer === 'true';
  if (Object.keys(body).length === 0) {
    throw new Error('Strava: at least one updatable field must be set');
  }
  const res = await apiRequest({
    service: 'Strava',
    method: 'PUT',
    url: `${API}/activities/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
    json: body,
  });
  return {
    outputs: { activity: res.data },
    logs: [`Strava activity update → ${id}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_strava',
  name: 'Strava',
  description: 'Fetch your Strava profile, activities and kudos using an OAuth access token.',
  iconName: 'LuActivity',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'athlete_me',
      label: 'Get me (athlete)',
      description: 'Fetch the authenticated athlete’s profile.',
      fields: [
        { id: 'apiKey', label: 'Access token', type: 'password', required: true },
      ],
      run: athleteMe,
    },
    {
      id: 'activities_list',
      label: 'List activities',
      description: 'Fetch the authenticated athlete’s activities.',
      fields: [
        { id: 'apiKey', label: 'Access token', type: 'password', required: true },
        { id: 'perPage', label: 'Per page', type: 'number', defaultValue: '30' },
        { id: 'page', label: 'Page', type: 'number' },
        { id: 'after', label: 'After (epoch seconds)', type: 'number' },
        { id: 'before', label: 'Before (epoch seconds)', type: 'number' },
      ],
      run: activitiesList,
    },
    {
      id: 'activity_get',
      label: 'Get activity',
      description: 'Fetch a single activity by id.',
      fields: [
        { id: 'apiKey', label: 'Access token', type: 'password', required: true },
        { id: 'activityId', label: 'Activity ID', type: 'text', required: true },
        { id: 'includeAllEfforts', label: 'Include all efforts (true/false)', type: 'text' },
      ],
      run: activityGet,
    },
    {
      id: 'activity_kudoers',
      label: 'List activity kudoers',
      description: 'Fetch the kudos givers of an activity.',
      fields: [
        { id: 'apiKey', label: 'Access token', type: 'password', required: true },
        { id: 'activityId', label: 'Activity ID', type: 'text', required: true },
      ],
      run: activityKudoers,
    },
    {
      id: 'activity_update',
      label: 'Update activity',
      description: 'Patch an existing activity. Only set fields are sent.',
      fields: [
        { id: 'apiKey', label: 'Access token', type: 'password', required: true },
        { id: 'activityId', label: 'Activity ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'sportType', label: 'Sport type', type: 'text', placeholder: 'Run' },
        { id: 'commute', label: 'Commute (true/false)', type: 'text' },
        { id: 'trainer', label: 'Trainer (true/false)', type: 'text' },
      ],
      run: activityUpdate,
    },
  ],
};

registerForgeBlock(block);
export default block;
