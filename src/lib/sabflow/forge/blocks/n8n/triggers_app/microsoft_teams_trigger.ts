/**
 * Forge block: Microsoft Teams Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The flow author must
 * create a Microsoft Graph change-notification subscription (push) whose
 * notificationUrl points at the SabFlow receiver.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Microsoft/Teams/MicrosoftTeamsTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = [
  'newChannel',
  'newChannelMessage',
  'newChat',
  'newChatMessage',
  'newTeamMember',
] as const;

const EVENT_TO_RESOURCE: Record<string, string> = {
  newChannel: 'teams/{teamId}/channels',
  newChannelMessage: 'teams/{teamId}/channels/{channelId}/messages',
  newChat: 'me/chats',
  newChatMessage: 'chats/{chatId}/messages',
  newTeamMember: 'teams/{teamId}/members',
};

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const event = asString(ctx.options.event) || 'newChannelMessage';
  const teamId = asString(ctx.options.teamId);
  const channelId = asString(ctx.options.channelId);
  const chatId = asString(ctx.options.chatId);
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  const resourceTemplate = EVENT_TO_RESOURCE[event] || EVENT_TO_RESOURCE.newChannelMessage;
  const resource = resourceTemplate
    .replace('{teamId}', teamId || '<teamId>')
    .replace('{channelId}', channelId || '<channelId>')
    .replace('{chatId}', chatId || '<chatId>');
  return {
    outputs: {
      service: 'Microsoft Teams',
      sabflowReceiverUrl,
      knownEvents: KNOWN_EVENTS,
      event,
      resource,
      teamId,
      channelId,
      chatId,
      registrationDocs: 'https://learn.microsoft.com/graph/teams-changenotifications-overview',
      registrationInstructions:
        `POST /subscriptions on Microsoft Graph with { changeType: "created", notificationUrl: "${sabflowReceiverUrl}", resource: "${resource}", expirationDateTime, clientState }. Confirm the validationToken challenge on first POST. Renew before expiration.`,
    },
    logs: [`Microsoft Teams trigger info → ${event} (${resource})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_microsoft_teams_trigger',
  name: 'Microsoft Teams Trigger (info)',
  description:
    'Returns the SabFlow receiver URL + Microsoft Graph resource to subscribe to. Register a change-notification subscription manually.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Graph resource for a Teams subscription.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'event',
          label: 'Event',
          type: 'select',
          options: KNOWN_EVENTS.map((e) => ({ value: e, label: e })),
          helperText: 'Teams event axis (n8n parity).',
        },
        {
          id: 'teamId',
          label: 'Team id (for channel/team events)',
          type: 'text',
          placeholder: '<teamId>',
        },
        {
          id: 'channelId',
          label: 'Channel id (for newChannelMessage)',
          type: 'text',
          placeholder: '<channelId>',
        },
        {
          id: 'chatId',
          label: 'Chat id (for newChatMessage)',
          type: 'text',
          placeholder: '<chatId>',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
