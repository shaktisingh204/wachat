/**
 * Forge block: RabbitMQ Trigger (info shim).
 *
 * RabbitMQ is a long-lived AMQP consumer — not a webhook. SabFlow currently
 * does not run persistent AMQP consumers, so this shim returns the
 * registration metadata the flow author would use to wire a bridge:
 *
 *   - Connect a small consumer service (e.g. a sidecar service or a
 *     dedicated worker) to the queue, and have it POST each message to the
 *     SabFlow webhook receiver URL.
 *   - OR use RabbitMQ's HTTP-shovel plugin to bridge the queue to the URL.
 *
 * Source: n8n-master/packages/nodes-base/nodes/RabbitMQ/RabbitMQTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const ACKNOWLEDGE_MODES = [
  'executionFinishes',
  'executionFinishesSuccessfully',
  'immediately',
  'laterMessageNode',
] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const queue = asString(ctx.options.queue);
  const acknowledge = asString(ctx.options.acknowledge) || 'immediately';
  const contentIsBinary = Boolean(ctx.options.contentIsBinary);

  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';

  return {
    outputs: {
      service: 'RabbitMQ',
      sabflowReceiverUrl,
      queue,
      supportedAcknowledgeModes: ACKNOWLEDGE_MODES,
      selected: { acknowledge, contentIsBinary },
      registrationDocs: 'https://www.rabbitmq.com/docs/shovel',
      registrationInstructions: [
        'RabbitMQ has no upstream "subscribe URL" API — n8n holds an AMQP consumer.',
        '1. Option A (recommended): run a tiny consumer service that basic.consume from `' +
          (queue || '<queue>') +
          '` and POST each message JSON to: ' + sabflowReceiverUrl,
        '2. Option B: enable rabbitmq_shovel_management + rabbitmq_shovel, then create a dynamic shovel with src-queue=' +
          (queue || '<queue>') +
          ' and dest-uri=' + sabflowReceiverUrl + ' (over the http-shovel protocol).',
        `3. Acknowledge mode "${acknowledge}" → SabFlow's webhook receiver always returns 200 immediately, so use "immediately" unless your bridge can replay on failure.`,
      ].join('\n'),
    },
    logs: [`RabbitMQ trigger info → queue=${queue || '<unset>'} ack=${acknowledge}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_rabbitmq_trigger',
  name: 'RabbitMQ Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + the RabbitMQ queue/ack metadata a flow author needs to wire a consumer or HTTP-shovel bridge. SabFlow does not hold a persistent AMQP consumer.',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description:
        'Return the SabFlow receiver URL + the RabbitMQ queue / acknowledge mode you want bridged into the flow.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'queue',
          label: 'Queue / topic',
          type: 'text',
          placeholder: 'e.g. orders.created',
        },
        {
          id: 'acknowledge',
          label: 'Delete from queue when',
          type: 'select',
          options: ACKNOWLEDGE_MODES.map((v) => ({ label: v, value: v })),
          helperText:
            'Matches n8n\'s acknowledge mode. SabFlow\'s receiver always 200s, so prefer "immediately" unless your bridge replays.',
        },
        {
          id: 'contentIsBinary',
          label: 'Content is binary',
          type: 'toggle',
          helperText:
            'When true, bridge should base64-encode the AMQP body before POSTing as { data: "<base64>" }.',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
