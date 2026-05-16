/**
 * Forge block: Zoom
 *
 * Source: n8n-master/packages/nodes-base/nodes/Zoom/Zoom.node.ts
 *
 * Zoom OAuth / JWT bearer token passed inline as a `password` field.
 *
 * Operations covered:
 *   - user.me                  GET    /users/me
 *   - meeting.create           POST   /users/{userId}/meetings
 *   - meeting.get              GET    /meetings/{meetingId}
 *   - meeting.list             GET    /users/{userId}/meetings
 *   - meeting.delete           DELETE /meetings/{meetingId}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.zoom.us/v2';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('Zoom: accessToken is required');
  return { Authorization: `Bearer ${token}` };
}

async function userMe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Zoom',
    method: 'GET',
    url: `${API}/users/me`,
    headers: authHeader(ctx),
  });
  return { outputs: { user: res.data }, logs: ['Zoom user me'] };
}

async function meetingCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const userId = asString(ctx.options.userId) || 'me';
  const topic = asString(ctx.options.topic);
  if (!topic) throw new Error('Zoom: topic is required');
  const meetingTypeStr = asString(ctx.options.meetingType) || '2';
  const meetingType = Number(meetingTypeStr);
  const body: Record<string, unknown> = { topic, type: meetingType };
  const startTime = asString(ctx.options.startTime);
  const duration = asString(ctx.options.duration);
  const timezone = asString(ctx.options.timezone);
  const password = asString(ctx.options.password);
  const agenda = asString(ctx.options.agenda);
  if (startTime) body.start_time = startTime;
  if (duration) body.duration = Number(duration);
  if (timezone) body.timezone = timezone;
  if (password) body.password = password;
  if (agenda) body.agenda = agenda;
  const res = await apiRequest({
    service: 'Zoom',
    method: 'POST',
    url: `${API}/users/${encodeURIComponent(userId)}/meetings`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { meeting: res.data }, logs: [`Zoom meeting create → ${topic}`] };
}

async function meetingGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.meetingId);
  if (!id) throw new Error('Zoom: meetingId is required');
  const res = await apiRequest({
    service: 'Zoom',
    method: 'GET',
    url: `${API}/meetings/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { meeting: res.data }, logs: [`Zoom meeting get → ${id}`] };
}

async function meetingList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const userId = asString(ctx.options.userId) || 'me';
  const params = new URLSearchParams();
  const type = asString(ctx.options.type);
  const pageSize = asString(ctx.options.pageSize);
  const nextPageToken = asString(ctx.options.nextPageToken);
  if (type) params.set('type', type);
  if (pageSize) params.set('page_size', pageSize);
  if (nextPageToken) params.set('next_page_token', nextPageToken);
  const res = await apiRequest({
    service: 'Zoom',
    method: 'GET',
    url: `${API}/users/${encodeURIComponent(userId)}/meetings${
      params.toString() ? `?${params.toString()}` : ''
    }`,
    headers: authHeader(ctx),
  });
  return { outputs: { meetings: res.data }, logs: [`Zoom meeting list → ${userId}`] };
}

async function meetingDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.meetingId);
  if (!id) throw new Error('Zoom: meetingId is required');
  const res = await apiRequest({
    service: 'Zoom',
    method: 'DELETE',
    url: `${API}/meetings/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return {
    outputs: { success: res.ok },
    logs: [`Zoom meeting delete → ${id}`],
  };
}

const MEETING_TYPE_OPTIONS = [
  { label: 'Instant', value: '1' },
  { label: 'Scheduled', value: '2' },
  { label: 'Recurring (no fixed time)', value: '3' },
  { label: 'Recurring (fixed time)', value: '8' },
];

const LIST_TYPE_OPTIONS = [
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Live', value: 'live' },
  { label: 'Upcoming', value: 'upcoming' },
];

const block: ForgeBlock = {
  id: 'forge_zoom',
  name: 'Zoom',
  description: 'Create, fetch, list and delete Zoom meetings.',
  iconName: 'LuVideo',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'user_me',
      label: 'Get current user',
      description: 'Fetch the profile of the authenticated Zoom user.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
      ],
      run: userMe,
    },
    {
      id: 'meeting_create',
      label: 'Create meeting',
      description: 'Schedule a Zoom meeting for the given user (defaults to me).',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'userId', label: 'User ID', type: 'text', defaultValue: 'me' },
        { id: 'topic', label: 'Topic', type: 'text', required: true },
        {
          id: 'meetingType',
          label: 'Type',
          type: 'select',
          options: MEETING_TYPE_OPTIONS,
          defaultValue: '2',
        },
        { id: 'startTime', label: 'Start time (ISO)', type: 'text' },
        { id: 'duration', label: 'Duration (minutes)', type: 'number' },
        { id: 'timezone', label: 'Timezone', type: 'text', placeholder: 'America/Los_Angeles' },
        { id: 'password', label: 'Password', type: 'text' },
        { id: 'agenda', label: 'Agenda', type: 'textarea' },
      ],
      run: meetingCreate,
    },
    {
      id: 'meeting_get',
      label: 'Get meeting',
      description: 'Fetch a single meeting by id.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'meetingId', label: 'Meeting ID', type: 'text', required: true },
      ],
      run: meetingGet,
    },
    {
      id: 'meeting_list',
      label: 'List meetings',
      description: 'List meetings for a Zoom user.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'userId', label: 'User ID', type: 'text', defaultValue: 'me' },
        { id: 'type', label: 'Type', type: 'select', options: LIST_TYPE_OPTIONS, defaultValue: 'scheduled' },
        { id: 'pageSize', label: 'Page size', type: 'number' },
        { id: 'nextPageToken', label: 'Next page token', type: 'text' },
      ],
      run: meetingList,
    },
    {
      id: 'meeting_delete',
      label: 'Delete meeting',
      description: 'Delete a meeting by id.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'meetingId', label: 'Meeting ID', type: 'text', required: true },
      ],
      run: meetingDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
