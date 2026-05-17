/**
 * Instagram surface — the `wachat-instagram` Rust crate, mounted at
 * `/v1/instagram`. Phase 7 `marketing.ts` covered the canonical posts +
 * accounts shape; this file adds the rest.
 */

import type { EndpointSpec } from '../types';
import { crudExtendedResource } from '../crud-extended';

const i = (
  resource: string,
  rustResource: string,
  options: Partial<{ idParam: string; display: string }> = {},
): EndpointSpec[] =>
  crudExtendedResource({
    module: 'instagram',
    resource,
    basePath: `/instagram/${resource}`,
    rustPath: `/v1/instagram/${rustResource}`,
    scopeRead: 'instagram:read',
    scopeWrite: 'instagram:write',
    idParam: options.idParam,
    display: options.display,
  });

export const instagramFullEndpoints: ReadonlyArray<EndpointSpec> = [
  ...i('stories', 'stories'),
  ...i('reels', 'reels'),
  ...i('messages', 'messages'),
  ...i('comments', 'comments'),
  ...i('insights', 'insights', { idParam: 'insightId' }),
];
