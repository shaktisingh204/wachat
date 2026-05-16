/**
 * Forge block: MQTT Trigger (info shim).
 *
 * MQTT is a *broker subscription* trigger — there is no inbound HTTP webhook
 * the way other triggers in this folder are wired. SabFlow can either:
 *   1. Use the existing `src/app/api/sabflow/webhook/[webhookId]/route.ts`
 *      endpoint if an external bridge (e.g. EMQX HTTP push, Mosquitto +
 *      `mosquitto_sub` → curl) republishes broker messages over HTTP, OR
 *   2. Run a long-lived subscriber worker in the SabFlow runtime (out of
 *      scope for the n8n-port sweep — tracked under triggers_long_running/).
 *
 * This shim returns the SabFlow receiver URL pattern + a config blob
 * describing the topics/QoS the flow expects, so a bridge can be wired by
 * hand for now.
 *
 * Source: n8n-master/packages/nodes-base/nodes/MQTT/MqttTrigger.node.ts
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
  const brokerUrl = asString(ctx.options.brokerUrl);
  const topicsRaw = ctx.options.topics;
  const topics = Array.isArray(topicsRaw)
    ? topicsRaw.map(asString).filter(Boolean)
    : asString(topicsRaw)
      .split(/[\n,]/)
      .map((t) => t.trim())
      .filter(Boolean);
  const jsonParseBody = ctx.options.jsonParseBody === true;
  const onlyMessage = ctx.options.onlyMessage === true;
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'MQTT',
      sabflowReceiverUrl,
      brokerUrl,
      topics,
      jsonParseBody,
      onlyMessage,
      registrationDocs: 'https://mqtt.org/',
      registrationInstructions:
        `MQTT is a broker subscription — no native HTTP push. Either (a) configure your broker (EMQX/HiveMQ rule engine, Mosquitto bridge, etc.) to POST each matching message to ${sabflowReceiverUrl}, OR (b) wait for the SabFlow MQTT long-running subscriber worker.`,
    },
    logs: [
      `MQTT trigger info → broker=${brokerUrl || '<unset>'} topics=${topics.length}`,
    ],
  };
}

const block: ForgeBlock = {
  id: 'forge_mqtt_trigger',
  name: 'MQTT Trigger (info)',
  description:
    'Returns the SabFlow receiver URL + MQTT topic/QoS config. Bridge broker messages to the URL via your broker rule engine.',
  iconName: 'LuRadio',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description:
        'Return the SabFlow receiver URL + topic subscription metadata for an external MQTT-to-HTTP bridge.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'brokerUrl',
          label: 'MQTT broker URL',
          type: 'text',
          placeholder: 'mqtts://broker.example.com:8883',
          helperText: 'Informational — used to render the bridge config.',
        },
        {
          id: 'topics',
          label: 'Topics (JSON array, or comma/newline separated)',
          type: 'json',
          placeholder: '["sensors/+/temperature", "alerts/#"]',
          helperText: 'MQTT topic filters to subscribe to.',
        },
        {
          id: 'jsonParseBody',
          label: 'Parse payload as JSON',
          type: 'toggle',
          helperText: 'Hint to the bridge: deliver decoded JSON, not raw bytes.',
        },
        {
          id: 'onlyMessage',
          label: 'Deliver only message body',
          type: 'toggle',
          helperText: 'Hint to the bridge: drop topic/QoS metadata, send only the payload.',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
