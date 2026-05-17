/**
 * CRM core surface — leads, deals, pipelines, accounts, contacts, custom
 * fields, saved views, labels, lookup. All standardised CRUD over the
 * matching Rust crates.
 */

import type { EndpointSpec } from '../types';
import { crudResource } from '../crud-template';

export const crmCoreEndpoints: ReadonlyArray<EndpointSpec> = [
  ...crudResource({
    module: 'crm',
    resource: 'leads',
    basePath: '/crm/leads',
    rustPath: '/v1/crm/leads',
    scopeRead: 'crm:leads:read',
    scopeWrite: 'crm:leads:write',
    emits: { create: 'crm.lead.created', update: 'crm.lead.updated', delete: 'crm.lead.deleted' },
  }),
  ...crudResource({
    module: 'crm',
    resource: 'deals',
    basePath: '/crm/deals',
    rustPath: '/v1/crm/deals',
    scopeRead: 'crm:deals:read',
    scopeWrite: 'crm:deals:write',
    emits: { create: 'crm.deal.created', update: 'crm.deal.updated', delete: 'crm.deal.deleted' },
  }),
  ...crudResource({
    module: 'crm',
    resource: 'pipelines',
    basePath: '/crm/pipelines',
    rustPath: '/v1/crm/pipelines',
    scopeRead: 'crm:pipelines:read',
    scopeWrite: 'crm:pipelines:write',
  }),
  ...crudResource({
    module: 'crm',
    resource: 'accounts',
    basePath: '/crm/accounts',
    rustPath: '/v1/crm/accounts',
    scopeRead: 'crm:accounts:read',
    scopeWrite: 'crm:accounts:write',
  }),
  ...crudResource({
    module: 'crm',
    resource: 'contacts',
    basePath: '/crm/contacts',
    rustPath: '/v1/crm/contacts',
    scopeRead: 'crm:contacts:read',
    scopeWrite: 'crm:contacts:write',
  }),
  ...crudResource({
    module: 'crm',
    resource: 'custom-fields',
    basePath: '/crm/custom-fields',
    rustPath: '/v1/crm/custom-fields',
    scopeRead: 'crm:settings:read',
    scopeWrite: 'crm:settings:write',
    idParam: 'customFieldId',
  }),
  ...crudResource({
    module: 'crm',
    resource: 'saved-views',
    basePath: '/crm/saved-views',
    rustPath: '/v1/crm/saved-views',
    scopeRead: 'crm:settings:read',
    scopeWrite: 'crm:settings:write',
    idParam: 'savedViewId',
  }),
  ...crudResource({
    module: 'crm',
    resource: 'labels',
    basePath: '/crm/labels',
    rustPath: '/v1/crm/labels',
    scopeRead: 'crm:settings:read',
    scopeWrite: 'crm:settings:write',
  }),
];
