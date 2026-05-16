/**
 * Forge block: Redis Trigger (info shim).
 *
 * Redis pub/sub is a long-lived TCP subscription — not a webhook. SabFlow does
 * not currently hold persistent SUBSCRIBE connections, so this shim returns
 * the registration metadata the flow author would use to wire a bridge:
 *
 *   - Run a small subscriber service that SUBSCRIBE/PSUBSCRIBE to the channels
 *     and POSTs each message to the SabFlow webhook receiver URL.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Redis/RedisTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const channelsRaw = asString(ctx.options.channels);
  const channels = channelsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const jsonParseBody = Boolean(ctx.options.jsonParseBody);
  const onlyMessage = Boolean(ctx.options.onlyMessage);

  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';

  return {
    outputs: {
      service: 'Redis',
      sabflowReceiverUrl,
      channels,
      selected: { jsonParseBody, onlyMessage },
      registrationDocs: 'https://redis.io/docs/latest/develop/interact/pubsub/',
      registrationInstructions: [
        'Redis pub/sub is connection-based; n8n holds a SUBSCRIBE on its side.',
        `1. Run a tiny subscriber: ${channels.some((c) => c.includes('*')) ? 'PSUBSCRIBE' : 'SUBSCRIBE'} ${channels.join(' ') || '<channels>'}`,
        '2. For each "message" or "pmessage" event, POST JSON to: ' + sabflowReceiverUrl,
        onlyMessage
          ? '   Body shape (onlyMessage=true): { "message": "<payload>" }'
          : '   Body shape: { "channel": "<channel>", "message": "<payload>" }',
        jsonParseBody
          ? '3. Bridge should JSON.parse the message string before sending so the flow sees an object.'
          : '3. Send the raw string message as-is — the flow can JSON.parse if needed.',
      ].join('\n'),
    },
    logs: [`Redis trigger info → channels=${channels.length} parse=${jsonParseBody}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_redis_trigger',
  name: 'Redis Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + the Redis channels/options a flow author needs to wire a SUBSCRIBE bridge. SabFlow does not hold a persistent SUBSCRIBE connection.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description:
        'Return the SabFlow receiver URL + the Redis channels and parsing options you want bridged into the flow.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'channels',
          label: 'Channels',
          type: 'text',
          placeholder: 'e.g. orders, notifications.*',
          helperText:
            'Comma-separated. Wildcard (*) becomes PSUBSCRIBE; otherwise SUBSCRIBE.',
        },
        {
          id: 'jsonParseBody',
          label: 'JSON parse body',
          type: 'toggle',
          helperText: 'Bridge should JSON.parse the message string before posting.',
        },
        {
          id: 'onlyMessage',
          label: 'Only message',
          type: 'toggle',
          helperText: 'Strip the channel name and post only { message: ... }.',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
