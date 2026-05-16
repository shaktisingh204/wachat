/**
 * Forge block: Venafi TLS Protect Trigger (info shim).
 *
 * This is a registration-info shim. Venafi TLS Protect Datacenter has no
 * webhook API — the n8n node is a polling trigger that queries
 * `/vedsdk/certificates` for newly-expired certs. Re-implementing that as a
 * SabFlow poller is a future wave; for now this block surfaces the supported
 * event slug.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Venafi/Datacenter/VenafiTlsProtectDatacenterTrigger.node.ts
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = ['certificateExpired'] as const;

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
      service: 'Venafi TLS Protect Datacenter',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      triggerMode: 'polling',
      registrationDocs: 'https://docs.venafi.com/Docs/current/TopNav/Content/SDK/WebSDK/r-SDK-POST-Certificates.php',
      registrationInstructions:
        'Venafi TLS Protect Datacenter has no webhooks — n8n polls /vedsdk/certificates with ValidToGreater/Less filters. A future SabFlow wave will turn this into a scheduled job that POSTs newly-expired certs to the SabFlow receiver URL.',
    },
    logs: [`Venafi trigger info → polling-only (${KNOWN_EVENTS.length} event)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_venafi_trigger',
  name: 'Venafi Trigger (info)',
  description:
    'Surfaces the polling-only Venafi TLS Protect Datacenter trigger metadata (certificateExpired). Venafi exposes no webhooks; auto-polling is a future wave.',
  iconName: 'LuShieldCheck',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Venafi event slug that the future poller will emit.',
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
          placeholder: '["certificateExpired"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
