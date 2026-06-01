// PORT-NOTE: Adapted from twenty-server/src/modules/blocklist/query-hooks/blocklist-update-many.pre-query.hook.ts
// Bulk update of blocklist entries is not allowed — the hook always throws.
// Ported as a plain function and class façade.

import "server-only";

import type { BlocklistItem } from "@/lib/sabcrm/server/src/modules/blocklist/blocklist-validation-manager/services/blocklist-validation.service";

export type UpdateManyArgs<T> = {
  filter: Partial<T>;
  data: Partial<T>;
};

export class BlocklistBulkUpdateNotAllowedError extends Error {
  constructor() {
    super("Method not allowed.");
    this.name = "BlocklistBulkUpdateNotAllowedError";
  }
}

// ---------------------------------------------------------------------------
// Pre-query hook function
// ---------------------------------------------------------------------------

export function blocklistUpdateManyPreQueryHook(): never {
  throw new BlocklistBulkUpdateNotAllowedError();
}

// ---------------------------------------------------------------------------
// Class façade
// ---------------------------------------------------------------------------

export class BlocklistUpdateManyPreQueryHook {
  async execute(): Promise<UpdateManyArgs<BlocklistItem>> {
    throw new BlocklistBulkUpdateNotAllowedError();
  }
}
