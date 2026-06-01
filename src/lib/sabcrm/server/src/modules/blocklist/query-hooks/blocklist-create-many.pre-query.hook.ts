// PORT-NOTE: Adapted from twenty-server/src/modules/blocklist/query-hooks/blocklist-create-many.pre-query.hook.ts
// The NestJS @WorkspaceQueryHook decorator is not applicable in Next.js.
// Ported as a plain pre-query validation function that callers invoke before
// executing a createMany operation on the blocklist collection.

import "server-only";

import {
  BlocklistValidationService,
  type BlocklistItem,
  type CreateManyArgs,
} from "@/lib/sabcrm/server/src/modules/blocklist/blocklist-validation-manager/services/blocklist-validation.service";

export type WorkspaceAuthContext = {
  user: { id: string };
  workspace: { id: string };
};

export class BlocklistValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userFriendlyMessage: string,
  ) {
    super(message);
    this.name = "BlocklistValidationError";
  }
}

// ---------------------------------------------------------------------------
// Pre-query hook function
// ---------------------------------------------------------------------------

const service = new BlocklistValidationService();

export async function blocklistCreateManyPreQueryHook(
  authContext: WorkspaceAuthContext,
  payload: CreateManyArgs<BlocklistItem>,
): Promise<CreateManyArgs<BlocklistItem>> {
  await service.validateBlocklistForCreateMany(
    payload,
    authContext.user.id,
    authContext.workspace.id,
  );

  return payload;
}

// ---------------------------------------------------------------------------
// Class façade (matches original hook structure)
// ---------------------------------------------------------------------------

export class BlocklistCreateManyPreQueryHook {
  private readonly blocklistValidationService = service;

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: CreateManyArgs<BlocklistItem>,
  ): Promise<CreateManyArgs<BlocklistItem>> {
    return blocklistCreateManyPreQueryHook(authContext, payload);
  }
}
