/**
 * Meta-platform shared endpoints — Suite, token mgmt, and Flow Builder.
 */

import type { EndpointSpec } from '../types';
import { crudExtendedResource } from '../crud-extended';

export const metaEndpoints: ReadonlyArray<EndpointSpec> = [
  ...crudExtendedResource({
    module: 'meta',
    resource: 'suite',
    basePath: '/meta/suite',
    rustPath: '/v1/meta/suite',
    scopeRead: 'meta:read',
    scopeWrite: 'meta:write',
    idParam: 'suiteId',
  }),
  ...crudExtendedResource({
    module: 'meta',
    resource: 'tokens',
    basePath: '/meta/tokens',
    rustPath: '/v1/meta/token',
    scopeRead: 'meta:read',
    scopeWrite: 'meta:write',
    idParam: 'tokenId',
    verbs: ['list', 'get', 'create', 'delete'],
  }),
  ...crudExtendedResource({
    module: 'meta',
    resource: 'flows',
    basePath: '/meta/flows',
    rustPath: '/v1/meta/flows',
    scopeRead: 'meta:read',
    scopeWrite: 'meta:write',
  }),
];
