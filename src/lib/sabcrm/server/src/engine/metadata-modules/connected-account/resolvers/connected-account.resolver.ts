'use server';

import 'server-only';

import {
  deleteConnectedAccount,
  findByUserWorkspaceId,
  verifyOwnership,
} from 'src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/connected-account-metadata.service';
import { type ConnectedAccountPublicDTO } from 'src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/dtos/connected-account-public.dto';
import { buildPublicConnectedAccount } from 'src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/utils/build-public-connected-account.util';
import { wrapWithConnectedAccountExceptionHandling } from 'src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/interceptors/connected-account-graphql-api-exception.interceptor';

// PORT-NOTE: Ported from NestJS GraphQL resolver.
// @UseGuards(WorkspaceAuthGuard, NoPermissionGuard) → caller must enforce auth before invoking.
// @AuthWorkspace() / @AuthUserWorkspaceId() → passed as explicit parameters.

/**
 * Equivalent of the myConnectedAccounts GraphQL query.
 * Returns connected accounts visible to the given userWorkspaceId.
 */
export async function myConnectedAccounts({
  workspaceId,
  userWorkspaceId,
}: {
  workspaceId: string;
  userWorkspaceId: string;
}): Promise<ConnectedAccountPublicDTO[]> {
  return wrapWithConnectedAccountExceptionHandling(async () => {
    const accounts = await findByUserWorkspaceId({
      userWorkspaceId,
      workspaceId,
    });
    return accounts.map((account) => buildPublicConnectedAccount(account));
  });
}

/**
 * Equivalent of the deleteConnectedAccount GraphQL mutation.
 * Verifies ownership then deletes the account.
 */
export async function deleteConnectedAccountAction({
  id,
  workspaceId,
  userWorkspaceId,
}: {
  id: string;
  workspaceId: string;
  userWorkspaceId: string;
}): Promise<ConnectedAccountPublicDTO> {
  return wrapWithConnectedAccountExceptionHandling(async () => {
    await verifyOwnership({ id, userWorkspaceId, workspaceId });

    const deleted = await deleteConnectedAccount({ id, workspaceId });

    return buildPublicConnectedAccount(deleted);
  });
}
