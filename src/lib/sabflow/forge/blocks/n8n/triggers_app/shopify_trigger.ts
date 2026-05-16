/**
 * Forge block: Shopify Trigger (info shim).
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via the
 * service's API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Shopify/ShopifyTrigger.node.ts
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
  'app/uninstalled',
  'carts/create',
  'carts/update',
  'checkouts/create',
  'checkouts/delete',
  'checkouts/update',
  'collections/create',
  'collections/delete',
  'collection_listings/add',
  'collection_listings/remove',
  'collection_listings/update',
  'collections/update',
  'customers/create',
  'customers/delete',
  'customers/disable',
  'customers/enable',
  'customer_groups/create',
  'customer_groups/delete',
  'customer_groups/update',
  'customers/update',
  'draft_orders/create',
  'draft_orders/delete',
  'draft_orders/update',
  'fulfillments/create',
  'fulfillment_events/create',
  'fulfillment_events/delete',
  'fulfillments/update',
  'inventory_items/create',
  'inventory_items/delete',
  'inventory_items/update',
  'inventory_levels/connect',
  'inventory_levels/disconnect',
  'inventory_levels/update',
  'locales/create',
  'locales/update',
  'locations/create',
  'locations/delete',
  'locations/update',
  'orders/cancelled',
  'orders/create',
  'orders/fulfilled',
  'orders/paid',
  'orders/partially_fulfilled',
  'order_transactions/create',
  'orders/updated',
  'orders/delete',
  'products/create',
  'products/delete',
  'product_listings/add',
  'product_listings/remove',
  'product_listings/update',
  'products/update',
  'refunds/create',
  'shop/update',
  'tender_transactions/create',
  'themes/create',
  'themes/delete',
  'themes/publish',
  'themes/update',
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
      service: 'Shopify',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://shopify.dev/docs/apps/build/webhooks',
      registrationInstructions:
        `Create a webhook in Shopify Admin → Notifications (or via the Admin API) pointing at ${sabflowReceiverUrl} with one of supportedEvents.`,
    },
    logs: [`Shopify trigger info → ${KNOWN_EVENTS.length} known topics`],
  };
}

const block: ForgeBlock = {
  id: 'forge_shopify_trigger',
  name: 'Shopify Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + Shopify webhook topics n8n supports. Register in Shopify manually.',
  iconName: 'LuShoppingBag',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Shopify webhook topics to subscribe to.',
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
          placeholder: '["orders/create", "products/update"]',
          helperText: 'Shopify webhook topics. See supportedEvents in the output.',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
