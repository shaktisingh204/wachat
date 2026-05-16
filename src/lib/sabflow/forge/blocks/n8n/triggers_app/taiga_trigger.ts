/**
 * Forge block: Taiga Trigger (info shim).
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via the
 * service's API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Taiga/TaigaTrigger.node.ts
 *
 * Taiga emits a payload with `type` (resource) + `action` (operation).
 * Resources: issue, milestone, task, userstory, wikipage.
 * Operations: create, change (update), delete.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_RESOURCES = ['issue', 'milestone', 'task', 'userstory', 'wikipage'] as const;
const KNOWN_OPERATIONS = ['create', 'change', 'delete'] as const;

const KNOWN_EVENTS = [
  'issue.create',
  'issue.change',
  'issue.delete',
  'milestone.create',
  'milestone.change',
  'milestone.delete',
  'task.create',
  'task.change',
  'task.delete',
  'userstory.create',
  'userstory.change',
  'userstory.delete',
  'wikipage.create',
  'wikipage.change',
  'wikipage.delete',
] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const eventTypesRaw = ctx.options.eventTypes;
  const eventTypes = Array.isArray(eventTypesRaw)
    ? eventTypesRaw.map(asString).filter(Boolean)
    : [];
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Taiga',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      supportedResources: KNOWN_RESOURCES,
      supportedOperations: KNOWN_OPERATIONS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://docs.taiga.io/api.html#webhooks',
      registrationInstructions:
        `POST /api/v1/webhooks in Taiga with project=<id>, url=${sabflowReceiverUrl}, and a shared key. Taiga streams every resource.operation pair to the URL — filter inside the flow.`,
    },
    logs: [`Taiga trigger info → ${KNOWN_EVENTS.length} known resource.operation pairs`],
  };
}

const block: ForgeBlock = {
  id: 'forge_taiga_trigger',
  name: 'Taiga Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + Taiga resource.operation pairs n8n supports. Register the URL in Taiga manually.',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Taiga resource.operation pairs to expect.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'eventTypes',
          label: 'Event types (JSON array)',
          type: 'json',
          placeholder: '["issue.create", "userstory.change"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
