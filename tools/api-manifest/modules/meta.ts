/**
 * Meta-platform shared endpoints — Suite, token mgmt, and Flow Builder.
 */

import type { EndpointSpec } from '../types';
import { crudResource } from '../crud-template';

export const metaEndpoints: ReadonlyArray<EndpointSpec> = [
  ...crudResource({
    module: 'meta',
    resource: 'suite',
    basePath: '/meta/suite',
    rustPath: '/v1/meta/suite',
    scopeRead: 'meta:read',
    scopeWrite: 'meta:write',
    idParam: 'suiteId',
  }),
  ...crudResource({
    module: 'meta',
    resource: 'tokens',
    basePath: '/meta/tokens',
    rustPath: '/v1/meta/token',
    scopeRead: 'meta:read',
    scopeWrite: 'meta:write',
    idParam: 'tokenId',
    verbs: ['list', 'get', 'create', 'delete'],
  }),
  ...crudResource({
    module: 'meta',
    resource: 'flows',
    basePath: '/meta/flows',
    rustPath: '/v1/meta/flows',
    scopeRead: 'meta:read',
    scopeWrite: 'meta:write',
  }),
];
