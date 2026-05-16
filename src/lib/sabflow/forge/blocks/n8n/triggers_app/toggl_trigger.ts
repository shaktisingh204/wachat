/**
 * Forge block: Toggl Trigger (info shim).
 *
 * This is a registration-info shim. Toggl has no webhook API — the n8n node is
 * a polling trigger that fetches `/time_entries` and tracks the lastTimeChecked
 * cursor itself. Re-implementing that as a SabFlow poller is a future wave; for
 * now this block just surfaces the supported event slug.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Toggl/TogglTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = ['newTimeEntry'] as const;

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
      service: 'Toggl',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      triggerMode: 'polling',
      registrationDocs: 'https://developers.track.toggl.com/docs/api/time_entries',
      registrationInstructions:
        'Toggl has no webhooks — n8n polls /me/time_entries on an interval. A future SabFlow wave will turn this into a scheduled job that POSTs new entries to the SabFlow receiver URL.',
    },
    logs: [`Toggl trigger info → polling-only (${KNOWN_EVENTS.length} event)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_toggl_trigger',
  name: 'Toggl Trigger (info)',
  description:
    'Surfaces the polling-only Toggl trigger metadata (newTimeEntry). Toggl exposes no webhooks; auto-polling is a future wave.',
  iconName: 'LuClock',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Toggl event slug that the future poller will emit.',
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
          placeholder: '["newTimeEntry"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
