// PORT-NOTE: NestJS createUnionType() has no Next.js equivalent.
// The union type is preserved as a plain TypeScript discriminated union.

import type { ObjectMetadataCommandMenuItemPayload } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/dtos/types/object-metadata-command-menu-item-payload.type';
import type { PathCommandMenuItemPayload } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/dtos/types/path-command-menu-item-payload.type';

export type CommandMenuItemPayload =
  | PathCommandMenuItemPayload
  | ObjectMetadataCommandMenuItemPayload;

/**
 * Resolves the concrete payload variant at runtime (mirrors GraphQL resolveType).
 */
export function resolveCommandMenuItemPayloadType(
  payload: CommandMenuItemPayload,
): 'PathCommandMenuItemPayload' | 'ObjectMetadataCommandMenuItemPayload' | undefined {
  if ('path' in payload) {
    return 'PathCommandMenuItemPayload';
  }

  if ('objectMetadataItemId' in payload) {
    return 'ObjectMetadataCommandMenuItemPayload';
  }

  return undefined;
}
