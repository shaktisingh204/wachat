// PORT-NOTE: Adapted from twenty-server/src/modules/blocklist/query-hooks/blocklist-create-one.pre-query.hook.ts
// NestJS @WorkspaceQueryHook converted to a plain pre-query validation function.

import "server-only";

import {
  BlocklistValidationService,
  type BlocklistItem,
} from "@/lib/sabcrm/server/src/modules/blocklist/blocklist-validation-manager/services/blocklist-validation.service";

export type WorkspaceAuthContext = {
  user: { id: string };
  workspace: { id: string };
};

export type CreateOneArgs<T> = { data: T };

const service = new BlocklistValidationService();

// ---------------------------------------------------------------------------
// Pre-query hook function
// ---------------------------------------------------------------------------

export async function blocklistCreateOnePreQueryHook(
  authContext: WorkspaceAuthContext,
  payload: CreateOneArgs<BlocklistItem>,
): Promise<CreateOneArgs<BlocklistItem>> {
  await service.validateBlocklistForCreateMany(
    { data: [payload.data] },
    authContext.user.id,
    authContext.workspace.id,
  );

  return payload;
}

// ---------------------------------------------------------------------------
// Class façade
// ---------------------------------------------------------------------------

export class BlocklistCreateOnePreQueryHook {
  private readonly blocklistValidationService = service;

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: CreateOneArgs<BlocklistItem>,
  ): Promise<CreateOneArgs<BlocklistItem>> {
    return blocklistCreateOnePreQueryHook(authContext, payload);
  }
}
