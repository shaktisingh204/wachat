/**
 * Forge block: Matrix
 *
 * Source: n8n-master/packages/nodes-base/nodes/Matrix/Matrix.node.ts (+ GenericFunctions.ts)
 * Credential type: 'matrix' — { homeserverUrl, accessToken } from CREDENTIAL_FIELD_SCHEMAS.
 *
 * Operations covered:
 *   - account.whoami     GET  /account/whoami
 *   - event.get          GET  /rooms/{roomId}/event/{eventId}
 *   - message.create     PUT  /rooms/{roomId}/send/m.room.message/{txnId}
 *   - message.getAll     GET  /rooms/{roomId}/messages
 *   - room.create        POST /createRoom
 *   - room.invite        POST /rooms/{roomId}/invite
 *   - room.join          POST /rooms/{roomIdOrAlias}/join
 *   - room.kick          POST /rooms/{roomId}/kick
 *   - room.leave         POST /rooms/{roomId}/leave
 *   - roomMember.getAll  GET  /rooms/{roomId}/members
 *
 * Out of scope: media upload — requires binary attachment plumbing the forge
 * runtime does not expose to action handlers yet.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';

type MatrixCred = { homeserverUrl: string; accessToken: string };

function credsOrThrow(ctx: ForgeActionContext): MatrixCred {
  const cred = requireCredential('Matrix', ctx.credential);
  const homeserverUrl = (cred.homeserverUrl ?? '').replace(/\/$/, '');
  const accessToken = cred.accessToken ?? '';
  if (!homeserverUrl) throw new Error('Matrix: credential missing `homeserverUrl`');
  if (!accessToken) throw new Error('Matrix: credential missing `accessToken`');
  return { homeserverUrl, accessToken };
}

async function matrix(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT',
  resourcePath: string,
  body?: unknown,
  qs?: Record<string, string>,
): Promise<unknown> {
  const { homeserverUrl, accessToken } = credsOrThrow(ctx);
  const search = qs ? `?${new URLSearchParams(qs).toString()}` : '';
  const res = await apiRequest({
    service: 'Matrix',
    method,
    url: `${homeserverUrl}/_matrix/client/r0${resourcePath}${search}`,
    headers: { Authorization: `Bearer ${accessToken}` },
    json: body,
  });
  return res.data;
}

function pseudoUuid(): string {
  // Matrix accepts any unique transaction id — short hex stamp is fine.
  return `n8n-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function messageCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const roomId = asString(ctx.options.roomId);
  const text = asString(ctx.options.text);
  if (!roomId) throw new Error('Matrix: roomId is required');
  if (!text) throw new Error('Matrix: text is required');

  const messageType = asString(ctx.options.messageType) || 'm.text';
  const messageFormat = asString(ctx.options.messageFormat) || 'plain';
  const body: Record<string, unknown> = {
    msgtype: messageType,
    body: text,
  };
  if (messageFormat === 'org.matrix.custom.html') {
    const fallbackText = asString(ctx.options.fallbackText);
    body.format = messageFormat;
    body.formatted_body = text;
    body.body = fallbackText || text;
  }
  const result = await matrix(
    ctx,
    'PUT',
    `/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${pseudoUuid()}`,
    body,
  );
  return { outputs: { message: result }, logs: [`Matrix message → ${roomId}`] };
}

async function messageGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const roomId = asString(ctx.options.roomId);
  if (!roomId) throw new Error('Matrix: roomId is required');
  const limit = asNumber(ctx.options.limit) ?? 50;
  const filter = asString(ctx.options.filter);
  const qs: Record<string, string> = { dir: 'b', limit: String(limit) };
  if (filter) qs.filter = filter;

  const result = (await matrix(ctx, 'GET', `/rooms/${encodeURIComponent(roomId)}/messages`, undefined, qs)) as {
    chunk?: unknown[];
  };
  return {
    outputs: { messages: result?.chunk ?? [], raw: result },
    logs: [`Matrix get messages → ${roomId}`],
  };
}

async function roomCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  const preset = asString(ctx.options.preset) || 'private_chat';
  if (!name) throw new Error('Matrix: name is required');
  const body: Record<string, unknown> = { name, preset };
  const roomAlias = asString(ctx.options.roomAlias);
  if (roomAlias) body.room_alias_name = roomAlias;
  const result = await matrix(ctx, 'POST', '/createRoom', body);
  return { outputs: { room: result }, logs: [`Matrix createRoom → ${name}`] };
}

async function roomInvite(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const roomId = asString(ctx.options.roomId);
  const userId = asString(ctx.options.userId);
  if (!roomId) throw new Error('Matrix: roomId is required');
  if (!userId) throw new Error('Matrix: userId is required');
  const result = await matrix(ctx, 'POST', `/rooms/${encodeURIComponent(roomId)}/invite`, {
    user_id: userId,
  });
  return { outputs: { result }, logs: [`Matrix invite → ${userId} to ${roomId}`] };
}

async function roomLeave(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const roomId = asString(ctx.options.roomId);
  if (!roomId) throw new Error('Matrix: roomId is required');
  const result = await matrix(ctx, 'POST', `/rooms/${encodeURIComponent(roomId)}/leave`);
  return { outputs: { result }, logs: [`Matrix leave → ${roomId}`] };
}

async function accountWhoami(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const result = await matrix(ctx, 'GET', '/account/whoami');
  return { outputs: { account: result }, logs: ['Matrix whoami'] };
}

async function roomJoin(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const roomIdOrAlias = asString(ctx.options.roomIdOrAlias);
  if (!roomIdOrAlias) throw new Error('Matrix: roomIdOrAlias is required');
  const result = await matrix(ctx, 'POST', `/rooms/${encodeURIComponent(roomIdOrAlias)}/join`);
  return { outputs: { result }, logs: [`Matrix join → ${roomIdOrAlias}`] };
}

async function roomKick(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const roomId = asString(ctx.options.roomId);
  const userId = asString(ctx.options.userId);
  if (!roomId) throw new Error('Matrix: roomId is required');
  if (!userId) throw new Error('Matrix: userId is required');
  const reason = asString(ctx.options.reason);
  const body: Record<string, unknown> = { user_id: userId };
  if (reason) body.reason = reason;
  const result = await matrix(ctx, 'POST', `/rooms/${encodeURIComponent(roomId)}/kick`, body);
  return { outputs: { result }, logs: [`Matrix kick → ${userId} from ${roomId}`] };
}

async function eventGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const roomId = asString(ctx.options.roomId);
  const eventId = asString(ctx.options.eventId);
  if (!roomId) throw new Error('Matrix: roomId is required');
  if (!eventId) throw new Error('Matrix: eventId is required');
  const result = await matrix(
    ctx,
    'GET',
    `/rooms/${encodeURIComponent(roomId)}/event/${encodeURIComponent(eventId)}`,
  );
  return { outputs: { event: result }, logs: [`Matrix event get → ${eventId}`] };
}

async function roomMemberGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const roomId = asString(ctx.options.roomId);
  if (!roomId) throw new Error('Matrix: roomId is required');
  const qs: Record<string, string> = {};
  const membership = asString(ctx.options.membership);
  const notMembership = asString(ctx.options.notMembership);
  if (membership) qs.membership = membership;
  if (notMembership) qs.not_membership = notMembership;
  const result = (await matrix(
    ctx,
    'GET',
    `/rooms/${encodeURIComponent(roomId)}/members`,
    undefined,
    qs,
  )) as { chunk?: unknown[] } | null;
  const members = result?.chunk ?? [];
  return {
    outputs: { members, raw: result },
    logs: [`Matrix room members → ${Array.isArray(members) ? members.length : 0}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_matrix',
  name: 'Matrix',
  description: 'Send messages and manage rooms on a Matrix homeserver.',
  iconName: 'LuHash',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'matrix' },
  actions: [
    {
      id: 'message_create',
      label: 'Send message',
      description: 'Send a message to a Matrix room.',
      fields: [
        { id: 'roomId', label: 'Room ID', type: 'text', required: true, placeholder: '!abc:matrix.org' },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        {
          id: 'messageType',
          label: 'Message type',
          type: 'select',
          defaultValue: 'm.text',
          options: [
            { label: 'Text', value: 'm.text' },
            { label: 'Notice', value: 'm.notice' },
            { label: 'Emote', value: 'm.emote' },
          ],
        },
        {
          id: 'messageFormat',
          label: 'Format',
          type: 'select',
          defaultValue: 'plain',
          options: [
            { label: 'Plain text', value: 'plain' },
            { label: 'HTML', value: 'org.matrix.custom.html' },
          ],
        },
        { id: 'fallbackText', label: 'Fallback text (HTML only)', type: 'text' },
      ],
      run: messageCreate,
    },
    {
      id: 'message_get_all',
      label: 'Get messages',
      description: 'Get recent messages from a room.',
      fields: [
        { id: 'roomId', label: 'Room ID', type: 'text', required: true },
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
        { id: 'filter', label: 'Filter (JSON or filter ID)', type: 'text' },
      ],
      run: messageGetAll,
    },
    {
      id: 'room_create',
      label: 'Create room',
      description: 'Create a new room.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        {
          id: 'preset',
          label: 'Preset',
          type: 'select',
          defaultValue: 'private_chat',
          options: [
            { label: 'Private', value: 'private_chat' },
            { label: 'Trusted private', value: 'trusted_private_chat' },
            { label: 'Public', value: 'public_chat' },
          ],
        },
        { id: 'roomAlias', label: 'Room alias (local part)', type: 'text' },
      ],
      run: roomCreate,
    },
    {
      id: 'room_invite',
      label: 'Invite to room',
      description: 'Invite a user to a room.',
      fields: [
        { id: 'roomId', label: 'Room ID', type: 'text', required: true },
        { id: 'userId', label: 'User ID', type: 'text', required: true, placeholder: '@user:matrix.org' },
      ],
      run: roomInvite,
    },
    {
      id: 'room_join',
      label: 'Join room',
      description: 'Join a room by id or alias.',
      fields: [
        { id: 'roomIdOrAlias', label: 'Room ID or alias', type: 'text', required: true },
      ],
      run: roomJoin,
    },
    {
      id: 'room_kick',
      label: 'Kick user from room',
      description: 'Remove a user from a room.',
      fields: [
        { id: 'roomId', label: 'Room ID', type: 'text', required: true },
        { id: 'userId', label: 'User ID', type: 'text', required: true },
        { id: 'reason', label: 'Reason', type: 'text' },
      ],
      run: roomKick,
    },
    {
      id: 'room_leave',
      label: 'Leave room',
      fields: [{ id: 'roomId', label: 'Room ID', type: 'text', required: true }],
      run: roomLeave,
    },
    {
      id: 'event_get',
      label: 'Get event',
      description: 'Fetch a single event from a room.',
      fields: [
        { id: 'roomId', label: 'Room ID', type: 'text', required: true },
        { id: 'eventId', label: 'Event ID', type: 'text', required: true },
      ],
      run: eventGet,
    },
    {
      id: 'room_member_get_all',
      label: 'Get room members',
      description: 'List members of a room with optional membership filters.',
      fields: [
        { id: 'roomId', label: 'Room ID', type: 'text', required: true },
        {
          id: 'membership',
          label: 'Membership',
          type: 'select',
          options: [
            { label: 'Any', value: '' },
            { label: 'Join', value: 'join' },
            { label: 'Invite', value: 'invite' },
            { label: 'Leave', value: 'leave' },
            { label: 'Ban', value: 'ban' },
            { label: 'Knock', value: 'knock' },
          ],
        },
        {
          id: 'notMembership',
          label: 'Exclude membership',
          type: 'select',
          options: [
            { label: 'None', value: '' },
            { label: 'Leave', value: 'leave' },
            { label: 'Ban', value: 'ban' },
          ],
        },
      ],
      run: roomMemberGetAll,
    },
    {
      id: 'account_whoami',
      label: 'Get current user',
      description: 'Return the user id for the access token.',
      fields: [],
      run: accountWhoami,
    },
  ],
};

registerForgeBlock(block);
export default block;
