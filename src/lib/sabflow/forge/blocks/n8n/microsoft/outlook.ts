/**
 * Forge block: Microsoft Outlook (Graph)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Microsoft/Outlook/{MicrosoftOutlook.node.ts, v2}
 * Credential type: 'microsoft_outlook' — { clientId, clientSecret, refreshToken }
 *
 * Operations (Graph v1.0):
 *   - message.send          POST /me/sendMail
 *   - message.list          GET  /me/messages
 *   - calendar.event.create POST /me/events
 *   - calendar.event.list   GET  /me/events
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { getOrRefreshAccessToken, MICROSOFT_TOKEN_URL } from '../_shared/google_oauth';

const BASE = 'https://graph.microsoft.com/v1.0';
const SERVICE = 'Microsoft Outlook';

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const token = await getOrRefreshAccessToken(SERVICE, ctx.credential, MICROSOFT_TOKEN_URL);
  const res = await apiRequest({
    service: SERVICE,
    method,
    url: `${BASE}${path}`,
    headers: { Authorization: `Bearer ${token}` },
    json,
  });
  return res.data;
}

function splitAddresses(raw: unknown): { emailAddress: { address: string } }[] {
  const s = asString(raw);
  return s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .map((address) => ({ emailAddress: { address } }));
}

async function messageSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const to = asString(ctx.options.to);
  const subject = asString(ctx.options.subject);
  const body = asString(ctx.options.body);
  if (!to) throw new Error(`${SERVICE}: to is required`);
  if (!subject) throw new Error(`${SERVICE}: subject is required`);
  const message: Record<string, unknown> = {
    subject,
    body: { contentType: asString(ctx.options.contentType) || 'Text', content: body },
    toRecipients: splitAddresses(to),
  };
  const cc = splitAddresses(ctx.options.cc);
  if (cc.length) message.ccRecipients = cc;
  const data = await call(ctx, 'POST', `/me/sendMail`, { message, saveToSentItems: true });
  return { outputs: { result: data }, logs: [`Outlook message send → ${to}`] };
}

async function messageList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const top = asString(ctx.options.top);
  const qs = top ? `?$top=${encodeURIComponent(top)}` : '';
  const data = await call(ctx, 'GET', `/me/messages${qs}`);
  return { outputs: { result: data }, logs: ['Outlook messages list'] };
}

async function eventCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const subject = asString(ctx.options.subject);
  const start = asString(ctx.options.start);
  const end = asString(ctx.options.end);
  if (!subject) throw new Error(`${SERVICE}: subject is required`);
  if (!start) throw new Error(`${SERVICE}: start is required (ISO 8601)`);
  if (!end) throw new Error(`${SERVICE}: end is required (ISO 8601)`);
  const tz = asString(ctx.options.timeZone) || 'UTC';
  const body: Record<string, unknown> = {
    subject,
    start: { dateTime: start, timeZone: tz },
    end: { dateTime: end, timeZone: tz },
  };
  const bodyContent = asString(ctx.options.body);
  if (bodyContent) body.body = { contentType: 'Text', content: bodyContent };
  const attendees = splitAddresses(ctx.options.attendees);
  if (attendees.length) body.attendees = attendees;
  const data = await call(ctx, 'POST', `/me/events`, body);
  return { outputs: { result: data }, logs: [`Outlook event create → ${subject}`] };
}

async function eventList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const top = asString(ctx.options.top);
  const qs = top ? `?$top=${encodeURIComponent(top)}` : '';
  const data = await call(ctx, 'GET', `/me/events${qs}`);
  return { outputs: { result: data }, logs: ['Outlook events list'] };
}

const block: ForgeBlock = {
  id: 'forge_microsoft_outlook',
  name: 'Microsoft Outlook',
  description: 'Send mail, list messages and manage calendar events in Outlook.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'microsoft_outlook' },
  actions: [
    {
      id: 'message_send',
      label: 'Send email',
      description: 'Send an email via Outlook.',
      fields: [
        { id: 'to', label: 'To (comma/semicolon separated)', type: 'text', required: true },
        { id: 'cc', label: 'CC', type: 'text' },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'body', label: 'Body', type: 'textarea' },
        {
          id: 'contentType',
          label: 'Content type',
          type: 'select',
          options: [
            { label: 'Text', value: 'Text' },
            { label: 'HTML', value: 'HTML' },
          ],
          defaultValue: 'Text',
        },
      ],
      run: messageSend,
    },
    {
      id: 'message_list',
      label: 'List messages',
      description: 'List messages in the signed-in user\'s mailbox.',
      fields: [{ id: 'top', label: 'Top (page size)', type: 'number', defaultValue: 25 }],
      run: messageList,
    },
    {
      id: 'event_create',
      label: 'Create calendar event',
      description: 'Create a calendar event on the default calendar.',
      fields: [
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'start', label: 'Start (ISO 8601)', type: 'text', required: true },
        { id: 'end', label: 'End (ISO 8601)', type: 'text', required: true },
        { id: 'timeZone', label: 'Time zone', type: 'text', defaultValue: 'UTC' },
        { id: 'body', label: 'Body', type: 'textarea' },
        { id: 'attendees', label: 'Attendees (comma-separated emails)', type: 'text' },
      ],
      run: eventCreate,
    },
    {
      id: 'event_list',
      label: 'List events',
      description: 'List upcoming events on the default calendar.',
      fields: [{ id: 'top', label: 'Top', type: 'number', defaultValue: 25 }],
      run: eventList,
    },
  ],
};

registerForgeBlock(block);
export default block;
