/**
 * Forge block: Box Trigger (info shim).
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via the
 * service's API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Box/BoxTrigger.node.ts
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
  'COLLABORATION.ACCEPTED',
  'COLLABORATION.CREATED',
  'COLLABORATION.REJECTED',
  'COLLABORATION.REMOVED',
  'COLLABORATION.UPDATED',
  'COMMENT.CREATED',
  'COMMENT.DELETED',
  'COMMENT.UPDATED',
  'FILE.COPIED',
  'FILE.DELETED',
  'FILE.DOWNLOADED',
  'FILE.LOCKED',
  'FILE.MOVED',
  'FILE.PREVIEWED',
  'FILE.RENAMED',
  'FILE.RESTORED',
  'FILE.TRASHED',
  'FILE.UNLOCKED',
  'FILE.UPLOADED',
  'FOLDER.COPIED',
  'FOLDER.CREATED',
  'FOLDER.DELETED',
  'FOLDER.DOWNLOADED',
  'FOLDER.MOVED',
  'FOLDER.RENAMED',
  'FOLDER.RESTORED',
  'FOLDER.TRASHED',
  'METADATA_INSTANCE.CREATED',
  'METADATA_INSTANCE.DELETED',
  'METADATA_INSTANCE.UPDATED',
  'SHARED_LINK.CREATED',
  'SHARED_LINK.DELETED',
  'SHARED_LINK.UPDATED',
  'TASK_ASSIGNMENT.CREATED',
  'TASK_ASSIGNMENT.UPDATED',
  'WEBHOOK.DELETED',
] as const;

const KNOWN_TARGET_TYPES = ['file', 'folder'] as const;

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
      service: 'Box',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      supportedTargetTypes: KNOWN_TARGET_TYPES,
      selectedEvents: eventTypes,
      registrationDocs: 'https://developer.box.com/guides/webhooks/v2/',
      registrationInstructions:
        `POST to https://api.box.com/2.0/webhooks with target={ id, type } (file|folder) and address=${sabflowReceiverUrl}. Set "triggers" to one or more of supportedEvents.`,
    },
    logs: [`Box trigger info → ${KNOWN_EVENTS.length} known triggers`],
  };
}

const block: ForgeBlock = {
  id: 'forge_box_trigger',
  name: 'Box Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + Box webhook trigger names n8n supports. Register via the Box API manually.',
  iconName: 'LuBox',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Box trigger names to subscribe to.',
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
          placeholder: '["FILE.UPLOADED", "FOLDER.CREATED"]',
          helperText: 'Uppercase, dot-separated Box trigger names.',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
