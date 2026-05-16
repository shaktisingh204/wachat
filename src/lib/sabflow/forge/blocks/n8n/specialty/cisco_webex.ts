/**
 * Forge block: Cisco Webex
 *
 * Source: n8n-master/packages/nodes-base/nodes/Cisco/Webex/CiscoWebex.node.ts
 *
 * Webex personal/bot access token passed inline as a Bearer credential.
 *
 * Operations covered:
 *   - person.me                GET   /v1/people/me
 *   - meeting.create           POST  /v1/meetings
 *   - meeting.get              GET   /v1/meetings/{id}
 *   - meeting.list             GET   /v1/meetings
 *   - message.create           POST  /v1/messages
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://webexapis.com/v1';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('Cisco Webex: accessToken is required');
  return { Authorization: `Bearer ${token}` };
}

async function personMe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Cisco Webex',
    method: 'GET',
    url: `${API}/people/me`,
    headers: authHeader(ctx),
  });
  return { outputs: { person: res.data }, logs: ['Cisco Webex person me'] };
}

async function meetingCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  const start = asString(ctx.options.start);
  const end = asString(ctx.options.end);
  if (!title) throw new Error('Cisco Webex: title is required');
  if (!start) throw new Error('Cisco Webex: start is required');
  if (!end) throw new Error('Cisco Webex: end is required');
  const body: Record<string, unknown> = { title, start, end };
  const agenda = asString(ctx.options.agenda);
  const password = asString(ctx.options.password);
  const timezone = asString(ctx.options.timezone);
  if (agenda) body.agenda = agenda;
  if (password) body.password = password;
  if (timezone) body.timezone = timezone;
  const res = await apiRequest({
    service: 'Cisco Webex',
    method: 'POST',
    url: `${API}/meetings`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { meeting: res.data }, logs: [`Cisco Webex meeting create → ${title}`] };
}

async function meetingGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.meetingId);
  if (!id) throw new Error('Cisco Webex: meetingId is required');
  const res = await apiRequest({
    service: 'Cisco Webex',
    method: 'GET',
    url: `${API}/meetings/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { meeting: res.data }, logs: [`Cisco Webex meeting get → ${id}`] };
}

async function meetingList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const from = asString(ctx.options.from);
  const to = asString(ctx.options.to);
  const max = asString(ctx.options.max);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (max) params.set('max', max);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Cisco Webex',
    method: 'GET',
    url: `${API}/meetings${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { meetings: res.data }, logs: ['Cisco Webex meeting list'] };
}

async function messageCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  const markdown = asString(ctx.options.markdown);
  const roomId = asString(ctx.options.roomId);
  const toPersonEmail = asString(ctx.options.toPersonEmail);
  const toPersonId = asString(ctx.options.toPersonId);
  if (!text && !markdown) throw new Error('Cisco Webex: text or markdown is required');
  if (!roomId && !toPersonEmail && !toPersonId) {
    throw new Error('Cisco Webex: roomId, toPersonEmail or toPersonId is required');
  }
  const body: Record<string, unknown> = {};
  if (roomId) body.roomId = roomId;
  if (toPersonEmail) body.toPersonEmail = toPersonEmail;
  if (toPersonId) body.toPersonId = toPersonId;
  if (text) body.text = text;
  if (markdown) body.markdown = markdown;
  const res = await apiRequest({
    service: 'Cisco Webex',
    method: 'POST',
    url: `${API}/messages`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { message: res.data }, logs: ['Cisco Webex message create'] };
}

const TOKEN_FIELD = {
  id: 'accessToken',
  label: 'Access token',
  type: 'password' as const,
  required: true,
  helperText: 'Personal or bot access token from developer.webex.com.',
};

const block: ForgeBlock = {
  id: 'forge_cisco_webex',
  name: 'Cisco Webex',
  description: 'Schedule Webex meetings, post messages and look up the current user.',
  iconName: 'LuVideo',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'person_me',
      label: 'Get current user',
      description: 'Fetch the authenticated Webex user profile.',
      fields: [TOKEN_FIELD],
      run: personMe,
    },
    {
      id: 'meeting_create',
      label: 'Create meeting',
      description: 'Schedule a new Webex meeting.',
      fields: [
        TOKEN_FIELD,
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'start', label: 'Start', type: 'text', required: true, placeholder: '2026-06-01T10:00:00Z' },
        { id: 'end', label: 'End', type: 'text', required: true, placeholder: '2026-06-01T11:00:00Z' },
        { id: 'agenda', label: 'Agenda', type: 'textarea' },
        { id: 'password', label: 'Password', type: 'password' },
        { id: 'timezone', label: 'Timezone', type: 'text', placeholder: 'America/Los_Angeles' },
      ],
      run: meetingCreate,
    },
    {
      id: 'meeting_get',
      label: 'Get meeting',
      description: 'Fetch a single meeting by id.',
      fields: [TOKEN_FIELD, { id: 'meetingId', label: 'Meeting ID', type: 'text', required: true }],
      run: meetingGet,
    },
    {
      id: 'meeting_list',
      label: 'List meetings',
      description: 'List meetings, optionally filtered by date range.',
      fields: [
        TOKEN_FIELD,
        { id: 'from', label: 'From', type: 'text', placeholder: '2026-06-01T00:00:00Z' },
        { id: 'to', label: 'To', type: 'text', placeholder: '2026-06-30T23:59:59Z' },
        { id: 'max', label: 'Max', type: 'number' },
      ],
      run: meetingList,
    },
    {
      id: 'message_create',
      label: 'Send message',
      description: 'Post a message to a room or to a person.',
      fields: [
        TOKEN_FIELD,
        { id: 'roomId', label: 'Room ID', type: 'text' },
        { id: 'toPersonEmail', label: 'To person email', type: 'text' },
        { id: 'toPersonId', label: 'To person ID', type: 'text' },
        { id: 'text', label: 'Text', type: 'textarea' },
        { id: 'markdown', label: 'Markdown', type: 'textarea' },
      ],
      run: messageCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
