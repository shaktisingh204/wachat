import "server-only";

// PORT-NOTE: Ported from Twenty's get-object-alias-for-group-by.util.ts.
// Returns the singular name alias for a flat object metadata item.

import type { FlatObjectMetadata } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';

export const getObjectAlias = (
  flatObjectMetadata: FlatObjectMetadata,
): string => {
  return flatObjectMetadata.nameSingular;
};
