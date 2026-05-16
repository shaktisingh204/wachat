/**
 * Forge block: MQTT
 *
 * Source: n8n-master/packages/nodes-base/nodes/MQTT/Mqtt.node.ts
 *
 * Uses the `mqtt` library. Broker URL is an inline `password` field (carries
 * user:pass).
 *
 * Operations covered:
 *   - publish      Publish a message to a topic
 *   - subscribe    One-shot: subscribe + read one message + close
 */

import { connect } from 'mqtt';
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asBoolean, asNumber, asString } from '../_shared/http';

function buildOpts(ctx: ForgeActionContext): Record<string, unknown> {
  const opts: Record<string, unknown> = {};
  const username = asString(ctx.options.username);
  const password = asString(ctx.options.password);
  if (username) opts.username = username;
  if (password) opts.password = password;
  const clientId = asString(ctx.options.clientId);
  if (clientId) opts.clientId = clientId;
  return opts;
}

async function publish(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('MQTT: url is required (e.g. mqtt://broker:1883)');
  const topic = asString(ctx.options.topic);
  if (!topic) throw new Error('MQTT: topic is required');
  const message = asString(ctx.options.message);
  if (!message) throw new Error('MQTT: message is required');
  const qos = asNumber(ctx.options.qos) ?? 0;
  const retain = asBoolean(ctx.options.retain);
  const client = connect(url, buildOpts(ctx));
  try {
    await new Promise<void>((resolve, reject) => {
      client.on('error', (err) => reject(err as Error));
      client.on('connect', () => {
        client.publish(
          topic,
          message,
          { qos: qos as 0 | 1 | 2, retain },
          (err) => (err ? reject(err) : resolve()),
        );
      });
    });
    return { outputs: { topic, qos, retain }, logs: [`MQTT publish → ${topic}`] };
  } finally {
    client.end(true);
  }
}

async function subscribe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('MQTT: url is required');
  const topic = asString(ctx.options.topic);
  if (!topic) throw new Error('MQTT: topic is required');
  const qos = asNumber(ctx.options.qos) ?? 0;
  const timeoutMs = asNumber(ctx.options.timeoutMs) ?? 10000;
  const client = connect(url, buildOpts(ctx));
  try {
    const result = await new Promise<{ topic: string; message: string } | null>((resolve, reject) => {
      const timer = setTimeout(() => resolve(null), timeoutMs);
      client.on('error', (err) => {
        clearTimeout(timer);
        reject(err as Error);
      });
      client.on('connect', () => {
        client.subscribe(topic, { qos: qos as 0 | 1 | 2 }, (err) => {
          if (err) {
            clearTimeout(timer);
            reject(err);
          }
        });
      });
      client.on('message', (t: string, payload: Buffer) => {
        clearTimeout(timer);
        resolve({ topic: t, message: payload.toString() });
      });
    });
    return {
      outputs: { received: result },
      logs: [`MQTT subscribe → ${topic} (${result ? 'received' : 'timeout'})`],
    };
  } finally {
    client.end(true);
  }
}

const CRED_FIELDS = [
  { id: 'url', label: 'Broker URL', type: 'text' as const, required: true, placeholder: 'mqtt://broker.hivemq.com:1883' },
  { id: 'username', label: 'Username', type: 'text' as const },
  { id: 'password', label: 'Password', type: 'password' as const },
  { id: 'clientId', label: 'Client ID', type: 'text' as const },
];

const QOS_OPTIONS = [
  { label: '0 — at most once', value: '0' },
  { label: '1 — at least once', value: '1' },
  { label: '2 — exactly once', value: '2' },
];

const block: ForgeBlock = {
  id: 'forge_mqtt',
  name: 'MQTT',
  description: 'Publish and subscribe to MQTT topics via the mqtt library.',
  iconName: 'LuWifi',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'publish',
      label: 'Publish',
      description: 'Send a message to an MQTT topic.',
      fields: [
        ...CRED_FIELDS,
        { id: 'topic', label: 'Topic', type: 'text', required: true },
        { id: 'message', label: 'Message', type: 'textarea', required: true },
        { id: 'qos', label: 'QoS', type: 'select', options: QOS_OPTIONS, defaultValue: '0' },
        { id: 'retain', label: 'Retain', type: 'toggle', defaultValue: false },
      ],
      run: publish,
    },
    {
      id: 'subscribe',
      label: 'Subscribe (one-shot)',
      description: 'Subscribe to a topic, wait for one message (or timeout), then close.',
      fields: [
        ...CRED_FIELDS,
        { id: 'topic', label: 'Topic', type: 'text', required: true },
        { id: 'qos', label: 'QoS', type: 'select', options: QOS_OPTIONS, defaultValue: '0' },
        { id: 'timeoutMs', label: 'Timeout (ms)', type: 'number', defaultValue: 10000 },
      ],
      run: subscribe,
    },
  ],
};

registerForgeBlock(block);
export default block;
