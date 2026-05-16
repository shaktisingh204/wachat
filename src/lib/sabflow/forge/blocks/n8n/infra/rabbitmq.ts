/**
 * Forge block: RabbitMQ
 *
 * Source: n8n-master/packages/nodes-base/nodes/RabbitMQ/RabbitMQ.node.ts
 *
 * Uses `amqplib`. URL credential goes inline as a `password` field.
 *
 * Operations covered:
 *   - publish.send    Publish one message to a queue or exchange
 *   - consume.fetch   One-shot consumer: read up to N messages then close
 */

import amqplib from 'amqplib';
import type { Channel } from 'amqplib';
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asBoolean, asNumber, asString } from '../_shared/http';

async function withChannel<T>(
  ctx: ForgeActionContext,
  fn: (channel: Channel) => Promise<T>,
): Promise<T> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('RabbitMQ: url is required (e.g. amqp://user:pass@host:5672)');
  const conn = await amqplib.connect(url);
  let channel: Channel | undefined;
  try {
    channel = await conn.createChannel();
    return await fn(channel);
  } finally {
    if (channel) await channel.close().catch(() => undefined);
    await conn.close().catch(() => undefined);
  }
}

async function publishSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const mode = asString(ctx.options.mode) || 'queue';
  const message = asString(ctx.options.message);
  if (!message) throw new Error('RabbitMQ: message is required');
  const buffer = Buffer.from(message);
  return withChannel(ctx, async (channel) => {
    if (mode === 'exchange') {
      const exchange = asString(ctx.options.exchange);
      const routingKey = asString(ctx.options.routingKey);
      if (!exchange) throw new Error('RabbitMQ: exchange is required when mode=exchange');
      channel.publish(exchange, routingKey, buffer, { persistent: true });
      return {
        outputs: { mode, exchange, routingKey },
        logs: [`RabbitMQ publish → exchange ${exchange} (${routingKey})`],
      };
    }
    const queue = asString(ctx.options.queue);
    if (!queue) throw new Error('RabbitMQ: queue is required when mode=queue');
    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, buffer, { persistent: true });
    return { outputs: { mode, queue }, logs: [`RabbitMQ publish → queue ${queue}`] };
  });
}

async function consumeFetch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const queue = asString(ctx.options.queue);
  if (!queue) throw new Error('RabbitMQ: queue is required');
  const max = asNumber(ctx.options.max) ?? 10;
  const noAck = asBoolean(ctx.options.noAck);
  return withChannel(ctx, async (channel) => {
    await channel.assertQueue(queue, { durable: true });
    const messages: unknown[] = [];
    for (let i = 0; i < max; i += 1) {
      const msg = await channel.get(queue, { noAck });
      if (!msg) break;
      const content = msg.content.toString();
      messages.push({ content, fields: msg.fields, properties: msg.properties });
      if (!noAck) channel.ack(msg);
    }
    return {
      outputs: { messages, count: messages.length },
      logs: [`RabbitMQ consume → ${messages.length} message(s) from ${queue}`],
    };
  });
}

const CRED_FIELDS = [
  { id: 'url', label: 'URL', type: 'password' as const, required: true, placeholder: 'amqp://user:pass@host:5672' },
];

const block: ForgeBlock = {
  id: 'forge_rabbitmq',
  name: 'RabbitMQ',
  description: 'Publish and consume RabbitMQ messages via amqplib.',
  iconName: 'LuRabbit',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'publish_send',
      label: 'Publish message',
      description: 'Send a message to a queue (default) or an exchange.',
      fields: [
        ...CRED_FIELDS,
        {
          id: 'mode',
          label: 'Mode',
          type: 'select',
          options: [
            { label: 'Queue', value: 'queue' },
            { label: 'Exchange', value: 'exchange' },
          ],
          defaultValue: 'queue',
        },
        { id: 'queue', label: 'Queue', type: 'text', placeholder: 'my-queue' },
        { id: 'exchange', label: 'Exchange', type: 'text', placeholder: 'amq.topic' },
        { id: 'routingKey', label: 'Routing key', type: 'text' },
        { id: 'message', label: 'Message body', type: 'textarea', required: true },
      ],
      run: publishSend,
    },
    {
      id: 'consume_fetch',
      label: 'Fetch messages',
      description: 'One-shot consumer: read up to N messages and ack them.',
      fields: [
        ...CRED_FIELDS,
        { id: 'queue', label: 'Queue', type: 'text', required: true },
        { id: 'max', label: 'Max messages', type: 'number', defaultValue: 10 },
        { id: 'noAck', label: 'No ack (peek)', type: 'toggle', defaultValue: false },
      ],
      run: consumeFetch,
    },
  ],
};

registerForgeBlock(block);
export default block;
