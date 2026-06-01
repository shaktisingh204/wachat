// PORT-NOTE: Adapted from twenty-server/src/modules/blocklist/query-hooks/blocklist-update-one.pre-query.hook.ts
// NestJS @WorkspaceQueryHook converted to a plain pre-query validation function.

import "server-only";

import {
  BlocklistValidationService,
  type BlocklistItem,
  type UpdateOneArgs,
} from "@/lib/sabcrm/server/src/modules/blocklist/blocklist-validation-manager/services/blocklist-validation.service";

export type WorkspaceAuthContext = {
  user: { id: string };
  workspace: { id: string };
};

const service = new BlocklistValidationService();

// ---------------------------------------------------------------------------
// Pre-query hook function
// ---------------------------------------------------------------------------

export async function blocklistUpdateOnePreQueryHook(
  authContext: WorkspaceAuthContext,
  payload: UpdateOneArgs<BlocklistItem>,
): Promise<UpdateOneArgs<BlocklistItem>> {
  await service.validateBlocklistForUpdateOne(
    payload,
    authContext.user.id,
    authContext.workspace.id,
  );

  return payload;
}

// ---------------------------------------------------------------------------
// Class façade
// ---------------------------------------------------------------------------

export class BlocklistUpdateOnePreQueryHook {
  private readonly blocklistValidationService = service;

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: UpdateOneArgs<BlocklistItem>,
  ): Promise<UpdateOneArgs<BlocklistItem>> {
    return blocklistUpdateOnePreQueryHook(authContext, payload);
  }
}
