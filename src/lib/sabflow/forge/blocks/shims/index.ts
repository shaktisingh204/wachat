/**
 * Step 28 — TypeScript shim executors.
 *
 * Eight Rust-stubbed integrations get real working executors here so the
 * `stub: true` banner stops showing.  Each block exposes its most-common
 * action (the 80/20 cut) with a typed credential field set; users can
 * always reach the long tail via the HTTP Request block.
 *
 * Patterns:
 *   - Bearer-token auth via `credential.apiKey` (most providers)
 *   - Basic auth via `credential.accountSid + authToken` (Twilio-style)
 *   - JSON request/response, error messages surfaced verbatim
 *   - Output written under `outputVariable` when set
 */

import { registerForgeBlock } from '../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../types';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

async function jsonRequest(opts: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}): Promise<unknown> {
  const res = await fetch(opts.url, {
    method: opts.method,
    headers: { Accept: 'application/json', ...opts.headers },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  const data: unknown = text ? safeJsonParse(text) : null;
  if (!res.ok) {
    const detail =
      typeof data === 'string' ? data : data ? JSON.stringify(data).slice(0, 400) : '';
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${detail}`);
  }
  return data;
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function writeOutput(
  ctx: ForgeActionContext,
  value: unknown,
): Record<string, unknown> {
  const key = str(ctx.options.outputVariable);
  return key ? { [key]: value, result: value } : { result: value };
}

/* ── 1. Trello ──────────────────────────────────────────────────────────── */

async function trelloCreateCard(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const key = ctx.credential?.apiKey;
  const token = ctx.credential?.token;
  if (!key || !token) throw new Error('Trello: select a credential (key + token)');
  const listId = str(ctx.options.listId);
  const name = str(ctx.options.name);
  if (!listId || !name) throw new Error('Trello: listId + name are required');

  const params = new URLSearchParams({
    key,
    token,
    idList: listId,
    name,
    desc: str(ctx.options.desc),
    pos: 'bottom',
  });
  const data = await jsonRequest({
    method: 'POST',
    url: `https://api.trello.com/1/cards?${params.toString()}`,
    headers: {},
  });
  return { outputs: writeOutput(ctx, data), logs: [`Trello: card created in list ${listId}`] };
}

registerForgeBlock({
  id: 'forge_trello',
  name: 'Trello',
  description: 'Create cards in a Trello list.',
  iconName: 'LuLayoutGrid',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'trello' },
  actions: [
    {
      id: 'create_card',
      label: 'Create card',
      description: 'Append a card to a Trello list.',
      fields: [
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'name',   label: 'Card name', type: 'text', required: true },
        { id: 'desc',   label: 'Description', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: trelloCreateCard,
    },
  ],
});

/* ── 2. ClickUp ─────────────────────────────────────────────────────────── */

async function clickupCreateTask(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = ctx.credential?.apiKey;
  if (!apiKey) throw new Error('ClickUp: select a credential (API token)');
  const listId = str(ctx.options.listId);
  const name = str(ctx.options.name);
  if (!listId || !name) throw new Error('ClickUp: listId + name are required');

  const data = await jsonRequest({
    method: 'POST',
    url: `https://api.clickup.com/api/v2/list/${encodeURIComponent(listId)}/task`,
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: {
      name,
      description: str(ctx.options.description),
      priority: ctx.options.priority ? Number(ctx.options.priority) : undefined,
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`ClickUp: task created in list ${listId}`] };
}

registerForgeBlock({
  id: 'forge_clickup',
  name: 'ClickUp',
  description: 'Create tasks in a ClickUp list.',
  iconName: 'LuListChecks',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'clickup' },
  actions: [
    {
      id: 'create_task',
      label: 'Create task',
      description: 'Append a task to a ClickUp list.',
      fields: [
        { id: 'listId',      label: 'List ID', type: 'text', required: true },
        { id: 'name',        label: 'Task name', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'text' },
        { id: 'priority',    label: 'Priority (1-4)', type: 'number' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: clickupCreateTask,
    },
  ],
});

/* ── 3. Mixpanel ────────────────────────────────────────────────────────── */

async function mixpanelTrack(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = ctx.credential?.projectToken ?? ctx.credential?.apiKey;
  if (!token) throw new Error('Mixpanel: select a credential (project token)');
  const event = str(ctx.options.event);
  if (!event) throw new Error('Mixpanel: event name is required');

  const propsRaw = ctx.options.properties;
  const properties: Record<string, unknown> =
    propsRaw && typeof propsRaw === 'object' && !Array.isArray(propsRaw)
      ? (propsRaw as Record<string, unknown>)
      : {};

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api.mixpanel.com/track?verbose=1',
    headers: { 'Content-Type': 'application/json' },
    body: [
      {
        event,
        properties: { token, ...properties, distinct_id: str(ctx.options.distinctId) },
      },
    ],
  });
  return { outputs: writeOutput(ctx, data), logs: [`Mixpanel: tracked "${event}"`] };
}

registerForgeBlock({
  id: 'forge_mixpanel',
  name: 'Mixpanel',
  description: 'Track events to a Mixpanel project.',
  iconName: 'LuChartLine',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'mixpanel' },
  actions: [
    {
      id: 'track',
      label: 'Track event',
      description: 'Send a single event to Mixpanel /track.',
      fields: [
        { id: 'event',      label: 'Event name', type: 'text', required: true },
        { id: 'distinctId', label: 'Distinct ID', type: 'text' },
        { id: 'properties', label: 'Properties (JSON)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: mixpanelTrack,
    },
  ],
});

/* ── 4. Amplitude ───────────────────────────────────────────────────────── */

async function amplitudeTrack(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = ctx.credential?.apiKey;
  if (!apiKey) throw new Error('Amplitude: select a credential (API key)');
  const event = str(ctx.options.event);
  if (!event) throw new Error('Amplitude: event_type is required');

  const propsRaw = ctx.options.properties;
  const eventProperties: Record<string, unknown> =
    propsRaw && typeof propsRaw === 'object' && !Array.isArray(propsRaw)
      ? (propsRaw as Record<string, unknown>)
      : {};

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api2.amplitude.com/2/httpapi',
    headers: { 'Content-Type': 'application/json' },
    body: {
      api_key: apiKey,
      events: [
        {
          event_type: event,
          user_id: str(ctx.options.userId) || undefined,
          device_id: str(ctx.options.deviceId) || undefined,
          event_properties: eventProperties,
        },
      ],
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Amplitude: tracked "${event}"`] };
}

registerForgeBlock({
  id: 'forge_amplitude',
  name: 'Amplitude',
  description: 'Track events to Amplitude analytics.',
  iconName: 'LuChartColumn',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'amplitude' },
  actions: [
    {
      id: 'track',
      label: 'Track event',
      description: 'Send an event to Amplitude HTTP API.',
      fields: [
        { id: 'event',      label: 'Event type', type: 'text', required: true },
        { id: 'userId',     label: 'User ID', type: 'text' },
        { id: 'deviceId',   label: 'Device ID', type: 'text' },
        { id: 'properties', label: 'Event properties (JSON)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: amplitudeTrack,
    },
  ],
});

/* ── 5. Pipedrive ───────────────────────────────────────────────────────── */

async function pipedriveCreateDeal(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiToken = ctx.credential?.apiToken ?? ctx.credential?.apiKey;
  const domain = ctx.credential?.domain ?? 'api';
  if (!apiToken) throw new Error('Pipedrive: select a credential (API token)');
  const title = str(ctx.options.title);
  if (!title) throw new Error('Pipedrive: title is required');

  const params = new URLSearchParams({ api_token: apiToken });
  const data = await jsonRequest({
    method: 'POST',
    url: `https://${domain}.pipedrive.com/api/v1/deals?${params.toString()}`,
    headers: { 'Content-Type': 'application/json' },
    body: {
      title,
      value: ctx.options.value ? Number(ctx.options.value) : undefined,
      currency: str(ctx.options.currency) || undefined,
      person_id: ctx.options.personId ? Number(ctx.options.personId) : undefined,
      org_id: ctx.options.orgId ? Number(ctx.options.orgId) : undefined,
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Pipedrive: created deal "${title}"`] };
}

registerForgeBlock({
  id: 'forge_pipedrive',
  name: 'Pipedrive',
  description: 'Create deals in your Pipedrive pipeline.',
  iconName: 'LuTrendingUp',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'pipedrive' },
  actions: [
    {
      id: 'create_deal',
      label: 'Create deal',
      description: 'Create a deal in Pipedrive.',
      fields: [
        { id: 'title',    label: 'Title', type: 'text', required: true },
        { id: 'value',    label: 'Value', type: 'number' },
        { id: 'currency', label: 'Currency (ISO 4217)', type: 'text' },
        { id: 'personId', label: 'Person ID', type: 'number' },
        { id: 'orgId',    label: 'Organisation ID', type: 'number' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: pipedriveCreateDeal,
    },
  ],
});

/* ── 6. Mailchimp ───────────────────────────────────────────────────────── */

async function mailchimpAddMember(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = ctx.credential?.apiKey;
  if (!apiKey) throw new Error('Mailchimp: select a credential (API key)');
  const listId = str(ctx.options.listId);
  const email = str(ctx.options.email);
  if (!listId || !email) throw new Error('Mailchimp: listId + email are required');

  // Mailchimp API key shape: "<key>-<datacenter>"
  const dc = apiKey.split('-')[1];
  if (!dc) throw new Error('Mailchimp: API key missing data-centre suffix');

  const basic = Buffer.from(`anystring:${apiKey}`).toString('base64');
  const data = await jsonRequest({
    method: 'POST',
    url: `https://${dc}.api.mailchimp.com/3.0/lists/${encodeURIComponent(listId)}/members`,
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
    body: {
      email_address: email,
      status: str(ctx.options.status) || 'subscribed',
      merge_fields: ctx.options.mergeFields ?? {},
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Mailchimp: subscribed ${email} to ${listId}`] };
}

registerForgeBlock({
  id: 'forge_mailchimp',
  name: 'Mailchimp',
  description: 'Subscribe contacts to a Mailchimp list.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'mailchimp' },
  actions: [
    {
      id: 'add_member',
      label: 'Add list member',
      description: 'Subscribe an email to a Mailchimp audience.',
      fields: [
        { id: 'listId',      label: 'Audience / List ID', type: 'text', required: true },
        { id: 'email',       label: 'Email', type: 'text', required: true },
        { id: 'status',      label: 'Status (subscribed/pending)', type: 'text' },
        { id: 'mergeFields', label: 'Merge fields (JSON)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: mailchimpAddMember,
    },
  ],
});

/* ── 7. Outlook Calendar ────────────────────────────────────────────────── */

async function outlookCreateEvent(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = ctx.credential?.accessToken ?? ctx.credential?.token;
  if (!accessToken) {
    throw new Error('Outlook: select an OAuth credential (access token)');
  }
  const subject = str(ctx.options.subject);
  const start = str(ctx.options.start);
  const end = str(ctx.options.end);
  if (!subject || !start || !end) {
    throw new Error('Outlook: subject + start + end are required');
  }

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://graph.microsoft.com/v1.0/me/events',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: {
      subject,
      start: { dateTime: start, timeZone: str(ctx.options.timeZone) || 'UTC' },
      end:   { dateTime: end,   timeZone: str(ctx.options.timeZone) || 'UTC' },
      body: { contentType: 'text', content: str(ctx.options.bodyText) },
      attendees: parseAttendees(ctx.options.attendees),
    },
  });
  return {
    outputs: writeOutput(ctx, data),
    logs: [`Outlook: created event "${subject}"`],
  };
}

function parseAttendees(value: unknown): Array<{ emailAddress: { address: string } }> {
  if (typeof value === 'string') {
    return value
      .split(/[,;\s]+/)
      .filter(Boolean)
      .map((e) => ({ emailAddress: { address: e } }));
  }
  if (Array.isArray(value)) {
    return (value as unknown[])
      .map((v) => str(v))
      .filter(Boolean)
      .map((e) => ({ emailAddress: { address: e } }));
  }
  return [];
}

registerForgeBlock({
  id: 'forge_outlook_calendar',
  name: 'Outlook Calendar',
  description: 'Create events on the connected Outlook calendar.',
  iconName: 'LuCalendarPlus',
  category: 'Integration',
  auth: { type: 'oauth', credentialType: 'microsoft' },
  actions: [
    {
      id: 'create_event',
      label: 'Create event',
      description: 'Add a meeting to your Outlook calendar.',
      fields: [
        { id: 'subject',  label: 'Subject', type: 'text', required: true },
        { id: 'start',    label: 'Start (ISO)', type: 'text', required: true },
        { id: 'end',      label: 'End (ISO)', type: 'text', required: true },
        { id: 'timeZone', label: 'Time zone (IANA)', type: 'text' },
        { id: 'bodyText', label: 'Body', type: 'text' },
        { id: 'attendees', label: 'Attendee emails (comma-sep)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: outlookCreateEvent,
    },
  ],
});

/* ── 8. Zoom ────────────────────────────────────────────────────────────── */

async function zoomCreateMeeting(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = ctx.credential?.accessToken ?? ctx.credential?.token;
  if (!accessToken) throw new Error('Zoom: select an OAuth credential');
  const topic = str(ctx.options.topic);
  if (!topic) throw new Error('Zoom: topic is required');

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api.zoom.us/v2/users/me/meetings',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: {
      topic,
      type: 2, // scheduled
      start_time: str(ctx.options.startTime) || undefined,
      duration: ctx.options.duration ? Number(ctx.options.duration) : 30,
      timezone: str(ctx.options.timezone) || 'UTC',
      agenda: str(ctx.options.agenda) || undefined,
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Zoom: meeting created "${topic}"`] };
}

registerForgeBlock({
  id: 'forge_zoom',
  name: 'Zoom',
  description: 'Schedule a Zoom meeting on the connected account.',
  iconName: 'LuVideo',
  category: 'Integration',
  auth: { type: 'oauth', credentialType: 'zoom' as never },
  actions: [
    {
      id: 'create_meeting',
      label: 'Create meeting',
      description: 'Schedule a Zoom meeting.',
      fields: [
        { id: 'topic',     label: 'Topic', type: 'text', required: true },
        { id: 'startTime', label: 'Start time (ISO)', type: 'text' },
        { id: 'duration',  label: 'Duration (min)', type: 'number' },
        { id: 'timezone',  label: 'Time zone (IANA)', type: 'text' },
        { id: 'agenda',    label: 'Agenda', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: zoomCreateMeeting,
    },
  ],
});

/* ── Shim block ids (exported for the registry barrel) ──────────────────── */
export const STEP_28_SHIM_BLOCK_IDS = [
  'forge_trello',
  'forge_clickup',
  'forge_mixpanel',
  'forge_amplitude',
  'forge_pipedrive',
  'forge_mailchimp',
  'forge_outlook_calendar',
  'forge_zoom',
] as const;
