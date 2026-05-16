/**
 * Forge block: Kafka Trigger (info shim).
 *
 * Registration-info shim. Kafka isn't a webhook source — n8n's trigger runs a
 * long-lived consumer. In SabFlow the equivalent would be a worker subscribing
 * to the topic; this block surfaces the connection metadata so a flow author
 * can wire it up to the SabFlow consumer or an external producer pushing into
 * the SabFlow webhook receiver.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Kafka/KafkaTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const DOCS_URL = 'https://kafka.apache.org/documentation/#consumerconfigs';
const KNOWN_EVENTS = ['message.received'] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const topic = asString(ctx.options.topic);
  const groupId = asString(ctx.options.groupId);
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Kafka',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: KNOWN_EVENTS,
      topic,
      groupId,
      registrationDocs: DOCS_URL,
      registrationInstructions: `Kafka has no webhook API. Either run a SabFlow consumer worker that subscribes to topic "${topic || '<topic>'}" with groupId "${groupId || '<groupId>'}", or have an upstream producer forward each message via POST to ${sabflowReceiverUrl}.`,
    },
    logs: ['Kafka trigger info → message.received (consumer-based)'],
  };
}

const block: ForgeBlock = {
  id: 'forge_kafka_trigger',
  name: 'Kafka Trigger (info)',
  description: 'Returns the SabFlow webhook URL pattern + Kafka topic/groupId metadata. Kafka has no native webhook — see registrationInstructions.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Kafka topic/groupId to consume.',
      fields: [
        { id: 'webhookId', label: 'SabFlow webhook id', type: 'text', placeholder: 'minted by SabFlow Connections', helperText: 'Leave blank to preview the URL pattern.' },
        { id: 'topic', label: 'Kafka topic', type: 'text', placeholder: 'orders' },
        { id: 'groupId', label: 'Consumer group id', type: 'text', placeholder: 'sabflow-consumers' },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
