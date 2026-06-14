/**
 * SabNode Developer Platform — manifest entry point.
 *
 * Loaded by the codegen and by `src/lib/api-platform/openapi.ts`. Order of
 * the `endpoints` array is insignificant; consumers should sort by `path`
 * for deterministic output.
 *
 * SCOPE: every SabNode module is in scope EXCEPT SabFlow. SabFlow is the
 * workflow/automation engine — developers integrate WITH it via triggers,
 * webhooks, and HTTP nodes inside flows, not by driving its CRUD over the
 * public API. The pre-existing `/api/v1/flows/[id]/run` trigger entry stays
 * hand-written and is intentionally NOT promoted into the manifest.
 *
 * To add a new endpoint:
 *   1. Append an `EndpointSpec` to the relevant `modules/<module>.ts` array
 *      (or create a new module file and import it here).
 *   2. Add any new component schemas to `schemas.ts`.
 *   3. Run `pnpm api:gen`.
 *   4. If you used `delegate: { kind: 'handler' }`, write the handler in a
 *      `_handlers.ts` co-located with the generated route.
 */

import type { Manifest } from './types';
import { sharedSchemas } from './schemas';

import { identityEndpoints } from './modules/identity';
import { keysEndpoints } from './modules/keys';
import { accountEndpoints } from './modules/account';
import { contactsEndpoints } from './modules/contacts';
import { messagesEndpoints } from './modules/messages';
// import { smsEndpoints } from './modules/sms'; // stubbed — DLT handler not yet implemented
import { wachatEndpoints } from './modules/wachat';
import { wachatTemplatesEndpoints } from './modules/wachat-templates';
import { broadcastsEndpoints } from './modules/broadcasts';
import { telegramEndpoints } from './modules/telegram';
import { sabfilesEndpoints } from './modules/sabfiles';
import { crmCoreEndpoints } from './modules/crm-core';
import { crmHrmEndpoints } from './modules/crm-hrm';
import { crmSalesEndpoints } from './modules/crm-sales';
import { crmInventoryEndpoints } from './modules/crm-inventory';
import { crmAccountingEndpoints } from './modules/crm-accounting';
import { crmPerformanceEndpoints } from './modules/crm-performance';
import { marketingEndpoints } from './modules/marketing';
import { webhooksEndpoints } from './modules/webhooks';
import { oauthAppsEndpoints } from './modules/oauth-apps';
import { usageEndpoints } from './modules/usage';
import { crmExtrasEndpoints } from './modules/crm-extras';
import { telegramFullEndpoints } from './modules/telegram-full';
import { facebookFullEndpoints } from './modules/facebook-full';
import { metaEndpoints } from './modules/meta';
import { wachatExtrasEndpoints } from './modules/wachat-extras';
import { wachatMeta2026Endpoints } from './modules/wachat-meta-2026';
import { instagramFullEndpoints } from './modules/instagram';
import { reportsEndpoints } from './modules/reports';
import { seoEndpoints } from './modules/seo';
import { shopEndpoints } from './modules/shop';
import { messagingChannelsEndpoints } from './modules/messaging-channels';
import { builderEndpoints } from './modules/builder';

export const manifest: Manifest = {
  info: {
    title: 'SabNode Public API',
    version: '1.0.0',
    description:
      'Versioned REST API for SabNode tenants. Authenticate with a Bearer ' +
      'API key; rate limits depend on subscription tier. The full taxonomy ' +
      'of error codes is served at /api/v1/openapi.',
  },
  endpoints: [
    ...identityEndpoints,
    ...keysEndpoints,
    ...accountEndpoints,
    ...contactsEndpoints,
    ...messagesEndpoints,
    // ...smsEndpoints,
    ...wachatEndpoints,
    ...wachatTemplatesEndpoints,
    ...broadcastsEndpoints,
    ...telegramEndpoints,
    ...sabfilesEndpoints,
    ...crmCoreEndpoints,
    ...crmHrmEndpoints,
    ...crmSalesEndpoints,
    ...crmInventoryEndpoints,
    ...crmAccountingEndpoints,
    ...crmPerformanceEndpoints,
    ...marketingEndpoints,
    ...webhooksEndpoints,
    ...oauthAppsEndpoints,
    ...usageEndpoints,
    ...crmExtrasEndpoints,
    ...telegramFullEndpoints,
    ...facebookFullEndpoints,
    ...metaEndpoints,
    ...wachatExtrasEndpoints,
    ...wachatMeta2026Endpoints,
    ...instagramFullEndpoints,
    ...reportsEndpoints,
    ...seoEndpoints,
    ...shopEndpoints,
    ...messagingChannelsEndpoints,
    ...builderEndpoints,
  ],
  schemas: sharedSchemas,
};

export type { EndpointSpec, Manifest, JsonSchema } from './types';
