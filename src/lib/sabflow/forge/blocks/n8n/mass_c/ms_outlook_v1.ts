/**
 * Forge block: Microsoft Outlook V1
 *
 * Source: n8n-master/packages/nodes-base/nodes/Microsoft/Outlook/v1/MicrosoftOutlookV1.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://graph.microsoft.com/v1.0';

function headers(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.accessToken);
  if (!token) throw new Error('MS Outlook: accessToken is required');
  return { Authorization: `Bearer ${token}` };
}

async function messagesList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const top = asString(ctx.options.top);
  const filter = asString(ctx.options.filter);
  if (top) params.set('$top', top);
  if (filter) params.set('$filter', filter);
  const url = `${API}/me/messages${params.size ? `?${params.toString()}` : ''}`;
  const res = await apiRequest({
    service: 'MS Outlook',
    method: 'GET',
    url,
    headers: headers(ctx),
  });
  return { outputs: { messages: res.data }, logs: ['MS Outlook messages list'] };
}

async function messageSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const subject = asString(ctx.options.subject);
  const body = asString(ctx.options.body);
  const to = asString(ctx.options.to);
  if (!subject || !body || !to) throw new Error('MS Outlook: subject, body and to are required');
  const toRecipients = to.split(',').map((e) => ({ emailAddress: { address: e.trim() } }));
  const res = await apiRequest({
    service: 'MS Outlook',
    method: 'POST',
    url: `${API}/me/sendMail`,
    headers: headers(ctx),
    json: {
      message: {
        subject,
        body: { contentType: 'HTML', content: body },
        toRecipients,
      },
    },
  });
  return { outputs: { status: res.status }, logs: [`MS Outlook send → ${to}`] };
}

async function messageMove(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const messageId = asString(ctx.options.messageId);
  const destinationId = asString(ctx.options.destinationId);
  if (!messageId || !destinationId)
    throw new Error('MS Outlook: messageId and destinationId are required');
  const res = await apiRequest({
    service: 'MS Outlook',
    method: 'POST',
    url: `${API}/me/messages/${encodeURIComponent(messageId)}/move`,
    headers: headers(ctx),
    json: { destinationId },
  });
  return { outputs: { message: res.data }, logs: [`MS Outlook move → ${destinationId}`] };
}

async function foldersList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'MS Outlook',
    method: 'GET',
    url: `${API}/me/mailFolders`,
    headers: headers(ctx),
  });
  return { outputs: { folders: res.data }, logs: ['MS Outlook folders list'] };
}

const block: ForgeBlock = {
  id: 'forge_ms_outlook_v1',
  name: 'Microsoft Outlook V1',
  description: 'Outlook mail ops (list, send, move, folders).',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'messages_list',
      label: 'List messages',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'top', label: 'Top (page size)', type: 'number', defaultValue: 25 },
        { id: 'filter', label: 'Filter ($filter)', type: 'text' },
      ],
      run: messagesList,
    },
    {
      id: 'message_send',
      label: 'Send message',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'body', label: 'Body (HTML)', type: 'textarea', required: true },
        { id: 'to', label: 'To (CSV)', type: 'text', required: true },
      ],
      run: messageSend,
    },
    {
      id: 'message_move',
      label: 'Move message',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'messageId', label: 'Message ID', type: 'text', required: true },
        { id: 'destinationId', label: 'Destination folder ID', type: 'text', required: true },
      ],
      run: messageMove,
    },
    {
      id: 'folders_list',
      label: 'List mail folders',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
      ],
      run: foldersList,
    },
  ],
};

registerForgeBlock(block);
export default block;
