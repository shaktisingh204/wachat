/**
 * Forge block: Kafka
 *
 * Source: n8n-master/packages/nodes-base/nodes/Kafka/Kafka.node.ts
 *
 * Uses `kafkajs`. Brokers field accepts a comma-separated list. SASL is
 * optional (PLAIN / SCRAM-SHA-256 / SCRAM-SHA-512).
 *
 * Operations covered:
 *   - produce.send    Publish one or more messages to a topic
 *   - consume.fetch   One-shot consumer: read up to N messages then close
 */

import type { KafkaConfig as KafkaJsConfig, EachMessagePayload } from 'kafkajs';
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asBoolean, asNumber, asString } from '../_shared/http';

type KafkaConfig = {
  clientId: string;
  brokers: string[];
  ssl?: boolean;
  sasl?: { mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512'; username: string; password: string };
};

function readConfig(ctx: ForgeActionContext): KafkaConfig {
  const brokers = asString(ctx.options.brokers)
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
  if (brokers.length === 0) throw new Error('Kafka: brokers is required (comma-separated list)');
  const clientId = asString(ctx.options.clientId) || 'sabflow-forge';
  const cfg: KafkaConfig = { clientId, brokers, ssl: asBoolean(ctx.options.ssl) };
  const mech = asString(ctx.options.saslMechanism).toLowerCase();
  const username = asString(ctx.options.saslUsername);
  if (mech && username) {
    cfg.sasl = {
      mechanism: mech as KafkaConfig['sasl'] extends infer S ? (S extends { mechanism: infer M } ? M : never) : never,
      username,
      password: asString(ctx.options.saslPassword),
    };
  }
  return cfg;
}

async function produceSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const topic = asString(ctx.options.topic);
  if (!topic) throw new Error('Kafka: topic is required');
  const messagesRaw = asString(ctx.options.messages);
  if (!messagesRaw) throw new Error('Kafka: messages is required');
  let parsed: unknown;
  try {
    parsed = JSON.parse(messagesRaw);
  } catch (err) {
    throw new Error(`Kafka: messages is not valid JSON — ${(err as Error).message}`);
  }
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  const formatted = arr.map((m) => {
    if (m && typeof m === 'object' && 'value' in (m as Record<string, unknown>)) {
      const obj = m as Record<string, unknown>;
      const value = typeof obj.value === 'string' ? obj.value : JSON.stringify(obj.value);
      return { ...obj, value };
    }
    return { value: typeof m === 'string' ? m : JSON.stringify(m) };
  });

  const cfg = readConfig(ctx);
  const { Kafka } = await import('kafkajs');
  const kafka = new Kafka(cfg as unknown as KafkaJsConfig);
  const producer = kafka.producer();
  await producer.connect();
  try {
    await producer.send({ topic, messages: formatted as unknown as { value: string }[] });
    return {
      outputs: { topic, count: formatted.length },
      logs: [`Kafka produce → ${formatted.length} message(s) to ${topic}`],
    };
  } finally {
    await producer.disconnect().catch(() => undefined);
  }
}

async function consumeFetch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const topic = asString(ctx.options.topic);
  if (!topic) throw new Error('Kafka: topic is required');
  const groupId = asString(ctx.options.groupId) || `sabflow-${Date.now()}`;
  const max = asNumber(ctx.options.max) ?? 10;
  const timeoutMs = asNumber(ctx.options.timeoutMs) ?? 5000;
  const fromBeginning = asBoolean(ctx.options.fromBeginning);

  const cfg = readConfig(ctx);
  const { Kafka } = await import('kafkajs');
  const kafka = new Kafka(cfg as unknown as KafkaJsConfig);
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning });

  const messages: unknown[] = [];
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => resolve(), timeoutMs);
    consumer
      .run({
        eachMessage: async (payload: EachMessagePayload) => {
          const msg = payload.message;
          messages.push({
            value: msg.value?.toString() ?? null,
            key: msg.key?.toString() ?? null,
          });
          if (messages.length >= max) {
            clearTimeout(timer);
            resolve();
          }
        },
      })
      .catch(() => {
        clearTimeout(timer);
        resolve();
      });
  });
  await consumer.stop().catch(() => undefined);
  await consumer.disconnect().catch(() => undefined);
  return {
    outputs: { messages, count: messages.length },
    logs: [`Kafka consume → ${messages.length} message(s) from ${topic}`],
  };
}

const CRED_FIELDS = [
  { id: 'brokers', label: 'Brokers (comma-separated)', type: 'text' as const, required: true, placeholder: 'broker1:9092,broker2:9092' },
  { id: 'clientId', label: 'Client ID', type: 'text' as const, defaultValue: 'sabflow-forge' },
  { id: 'ssl', label: 'SSL', type: 'toggle' as const, defaultValue: false },
  {
    id: 'saslMechanism',
    label: 'SASL mechanism',
    type: 'select' as const,
    options: [
      { label: 'None', value: '' },
      { label: 'PLAIN', value: 'plain' },
      { label: 'SCRAM-SHA-256', value: 'scram-sha-256' },
      { label: 'SCRAM-SHA-512', value: 'scram-sha-512' },
    ],
    defaultValue: '',
  },
  { id: 'saslUsername', label: 'SASL username', type: 'text' as const },
  { id: 'saslPassword', label: 'SASL password', type: 'password' as const },
];

const block: ForgeBlock = {
  id: 'forge_kafka',
  name: 'Kafka',
  description: 'Produce and consume Kafka messages via kafkajs.',
  iconName: 'LuRadio',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'produce_send',
      label: 'Send messages',
      description: 'Publish one or more messages to a topic.',
      fields: [
        ...CRED_FIELDS,
        { id: 'topic', label: 'Topic', type: 'text', required: true },
        {
          id: 'messages',
          label: 'Messages (JSON array)',
          type: 'json',
          required: true,
          placeholder: '[{"value": "hello"}]',
        },
      ],
      run: produceSend,
    },
    {
      id: 'consume_fetch',
      label: 'Fetch messages',
      description: 'One-shot consumer: read up to N messages, then close.',
      fields: [
        ...CRED_FIELDS,
        { id: 'topic', label: 'Topic', type: 'text', required: true },
        { id: 'groupId', label: 'Group ID', type: 'text', placeholder: 'sabflow-consumer' },
        { id: 'max', label: 'Max messages', type: 'number', defaultValue: 10 },
        { id: 'timeoutMs', label: 'Timeout (ms)', type: 'number', defaultValue: 5000 },
        { id: 'fromBeginning', label: 'From beginning', type: 'toggle', defaultValue: false },
      ],
      run: consumeFetch,
    },
  ],
};

registerForgeBlock(block);
export default block;
