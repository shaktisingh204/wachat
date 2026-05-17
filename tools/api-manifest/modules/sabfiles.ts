/**
 * SabFiles — R2-backed file storage. Forwards to the `sabfiles` Rust crate.
 *
 * IMPORTANT (SabFiles policy): the public API never accepts free-text URLs
 * for file inputs. Developers must `POST /sabfiles` (or upload through the
 * tenant's library UI) and reference the resulting file id in downstream
 * sends. Mirrors the in-app picker rule.
 */

import type { EndpointSpec } from '../types';
import { crudExtendedResource } from '../crud-extended';

export const sabfilesEndpoints: ReadonlyArray<EndpointSpec> = [
  ...crudExtendedResource({
    module: 'sabfiles',
    resource: 'files',
    basePath: '/sabfiles',
    rustPath: '/v1/sabfiles',
    scopeRead: 'sabfiles:read',
    scopeWrite: 'sabfiles:write',
    emits: { create: 'sabfiles.file.uploaded', delete: 'sabfiles.file.deleted' },
    display: 'SabFiles entries',
    verbs: ['list', 'get', 'create', 'delete'],
  }),
];
