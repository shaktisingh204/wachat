/**
 * Forge block: DHL Tracking
 *
 * Source: n8n-master/packages/nodes-base/nodes/Dhl/Dhl.node.ts
 *
 * DHL Shipment Tracking — Unified API. Auth is an API key passed via the
 * `DHL-API-Key` header (also accepted as a query string in DHL docs; we use
 * the header to keep tracking numbers out of access logs).
 *
 * Operations covered:
 *   - shipment.track           GET /track/shipments?trackingNumber=...
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api-eu.dhl.com';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('DHL: apiKey is required');
  return { 'DHL-API-Key': apiKey, Accept: 'application/json' };
}

async function shipmentTrack(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const trackingNumber = asString(ctx.options.trackingNumber).trim();
  if (!trackingNumber) throw new Error('DHL: trackingNumber is required');
  const params = new URLSearchParams({ trackingNumber });
  const service = asString(ctx.options.service).trim();
  const requesterCountryCode = asString(ctx.options.requesterCountryCode).trim();
  const originCountryCode = asString(ctx.options.originCountryCode).trim();
  const language = asString(ctx.options.language).trim();
  const limit = asString(ctx.options.limit).trim();
  if (service) params.set('service', service);
  if (requesterCountryCode) params.set('requesterCountryCode', requesterCountryCode);
  if (originCountryCode) params.set('originCountryCode', originCountryCode);
  if (language) params.set('language', language);
  if (limit) params.set('limit', limit);
  const res = await apiRequest({
    service: 'DHL',
    method: 'GET',
    url: `${API}/track/shipments?${params.toString()}`,
    headers: authHeader(ctx),
  });
  return {
    outputs: { shipments: res.data },
    logs: [`DHL track → ${trackingNumber}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_dhl',
  name: 'DHL Tracking',
  description: 'Track DHL shipments via the DHL Unified Shipment Tracking API.',
  iconName: 'LuPackage',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'shipment_track',
      label: 'Track shipment',
      description: 'Look up a shipment by tracking number.',
      fields: [
        { id: 'apiKey', label: 'DHL API key', type: 'password', required: true },
        { id: 'trackingNumber', label: 'Tracking number', type: 'text', required: true },
        {
          id: 'service',
          label: 'Service',
          type: 'text',
          placeholder: 'express',
          helperText: 'Optional — restrict to a specific DHL service (e.g. `express`, `parcel-de`).',
        },
        { id: 'requesterCountryCode', label: 'Requester country code', type: 'text', placeholder: 'DE' },
        { id: 'originCountryCode', label: 'Origin country code', type: 'text', placeholder: 'DE' },
        { id: 'language', label: 'Language', type: 'text', placeholder: 'en' },
        { id: 'limit', label: 'Limit', type: 'number' },
      ],
      run: shipmentTrack,
    },
  ],
};

registerForgeBlock(block);
export default block;
