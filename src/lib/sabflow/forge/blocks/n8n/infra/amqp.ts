/**
 * Forge block: AMQP 1.0
 *
 * Source: n8n-master/packages/nodes-base/nodes/Amqp/Amqp.node.ts
 *
 * Generic AMQP 1.0 via `rhea`. Note this is distinct from RabbitMQ's 0.9.1
 * protocol (see `rabbitmq.ts`). Use this block for Azure Service Bus, Apache
 * ActiveMQ Artemis, etc.
 *
 * Operations covered:
 *   - send       Send one message to an address/queue
 *   - receive    One-shot: receive one message (or timeout)
 */

import { connect, type Connection, type ConnectionOptions, type EventContext } from 'rhea';
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString } from '../_shared/http';

function connectOpts(ctx: ForgeActionContext): Record<string, unknown> {
  const host = asString(ctx.options.host);
  if (!host) throw new Error('AMQP: host is required');
  const opts: Record<string, unknown> = {
    host,
    port: asNumber(ctx.options.port) ?? 5672,
    transport: asString(ctx.options.transport) || 'tcp',
  };
  const username = asString(ctx.options.username);
  if (username) opts.username = username;
  const password = asString(ctx.options.password);
  if (password) opts.password = password;
  return opts;
}

async function send(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const address = asString(ctx.options.address);
  if (!address) throw new Error('AMQP: address is required');
  const body = asString(ctx.options.body);
  if (!body) throw new Error('AMQP: body is required');
  const connection: Connection = connect(connectOpts(ctx) as unknown as ConnectionOptions);
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('AMQP: send timed out')), 15000);
      const sender = connection.open_sender(address);
      sender.on('sendable', () => {
        sender.send({ body });
      });
      sender.on('accepted', () => {
        clearTimeout(timeout);
        sender.close();
        resolve();
      });
      sender.on('rejected', (ctxEv: EventContext) => {
        clearTimeout(timeout);
        reject(new Error(`AMQP: delivery rejected — ${JSON.stringify(ctxEv)}`));
      });
      connection.on('connection_error', (ctxEv: EventContext) => {
        clearTimeout(timeout);
        reject((ctxEv.error as Error) ?? new Error('AMQP: connection error'));
      });
    });
    return { outputs: { address }, logs: [`AMQP send → ${address}`] };
  } finally {
    connection.close();
  }
}

async function receive(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const address = asString(ctx.options.address);
  if (!address) throw new Error('AMQP: address is required');
  const timeoutMs = asNumber(ctx.options.timeoutMs) ?? 10000;
  const connection: Connection = connect(connectOpts(ctx) as unknown as ConnectionOptions);
  try {
    const message = await new Promise<unknown>((resolve) => {
      const timer = setTimeout(() => resolve(null), timeoutMs);
      const receiver = connection.open_receiver(address);
      receiver.on('message', (ctxEv: EventContext) => {
        clearTimeout(timer);
        const msg = ctxEv.message ?? null;
        resolve(msg);
        receiver.close();
      });
    });
    return {
      outputs: { message },
      logs: [`AMQP receive → ${address} (${message ? 'received' : 'timeout'})`],
    };
  } finally {
    connection.close();
  }
}

const CRED_FIELDS = [
  { id: 'host', label: 'Host', type: 'text' as const, required: true, placeholder: 'broker.example.com' },
  { id: 'port', label: 'Port', type: 'number' as const, defaultValue: 5672 },
  {
    id: 'transport',
    label: 'Transport',
    type: 'select' as const,
    options: [
      { label: 'TCP', value: 'tcp' },
      { label: 'TLS', value: 'tls' },
      { label: 'SSL', value: 'ssl' },
    ],
    defaultValue: 'tcp',
  },
  { id: 'username', label: 'Username', type: 'text' as const },
  { id: 'password', label: 'Password', type: 'password' as const },
];

const block: ForgeBlock = {
  id: 'forge_amqp',
  name: 'AMQP 1.0',
  description: 'Send and receive AMQP 1.0 messages via the rhea library.',
  iconName: 'LuShare2',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'send',
      label: 'Send message',
      description: 'Send a message to an AMQP address.',
      fields: [
        ...CRED_FIELDS,
        { id: 'address', label: 'Address / queue', type: 'text', required: true },
        { id: 'body', label: 'Body', type: 'textarea', required: true },
      ],
      run: send,
    },
    {
      id: 'receive',
      label: 'Receive message (one-shot)',
      description: 'Wait for one message from an AMQP address.',
      fields: [
        ...CRED_FIELDS,
        { id: 'address', label: 'Address / queue', type: 'text', required: true },
        { id: 'timeoutMs', label: 'Timeout (ms)', type: 'number', defaultValue: 10000 },
      ],
      run: receive,
    },
  ],
};

registerForgeBlock(block);
export default block;
