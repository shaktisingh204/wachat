/**
 * Complete Facebook surface — every `/v1/facebook/*` Rust crate.
 * Extends `marketing.ts` which only covered pages/posts/comments.
 */

import type { EndpointSpec } from '../types';
import { crudResource } from '../crud-template';

const f = (
  resource: string,
  basePath: string,
  rustPath: string,
  options: Partial<{ idParam: string; display: string }> = {},
): EndpointSpec[] =>
  crudResource({
    module: 'facebook',
    resource,
    basePath,
    rustPath,
    scopeRead: 'facebook:read',
    scopeWrite: 'facebook:write',
    idParam: options.idParam,
    display: options.display,
  });

export const facebookFullEndpoints: ReadonlyArray<EndpointSpec> = [
  ...f('agents', '/facebook/agents', '/v1/facebook/agents'),
  ...f('automation', '/facebook/automation', '/v1/facebook/automation', { idParam: 'automationId' }),
  ...f('business', '/facebook/business', '/v1/facebook/business', { idParam: 'businessId' }),
  ...f('crm-records', '/facebook/crm', '/v1/facebook/crm', { idParam: 'crmRecordId' }),
  ...f('events', '/facebook/events', '/v1/facebook/events'),
  ...f('lead-gen', '/facebook/lead-gen', '/v1/facebook/lead-gen', { idParam: 'leadGenId' }),
  ...f('messaging', '/facebook/messaging', '/v1/facebook/messaging', { idParam: 'messageId' }),
  ...f('messenger-profile', '/facebook/messenger-profile', '/v1/facebook/messenger-profile', { idParam: 'messengerProfileId' }),
  ...f('misc', '/facebook/misc', '/v1/facebook/misc', { idParam: 'miscId' }),
  ...f('flows', '/facebook/flow', '/v1/facebook/flow'),
];
