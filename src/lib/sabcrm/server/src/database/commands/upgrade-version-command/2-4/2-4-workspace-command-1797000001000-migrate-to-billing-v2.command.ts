import "server-only";

// PORT-NOTE: The original command extended ActiveOrSuspendedWorkspaceCommandRunner
// (a NestJS nest-commander class) and used @RegisteredWorkspaceCommand +
// @Command decorators. In SabNode there is no nest-commander / NestJS DI.
//
// This is a no-op workspace command: all workspaces are already on the
// resource-credit billing model, so `runOnWorkspace` just logs and returns.
// The ported function signature mirrors the original behaviour.

export const VERSION = '2.4.0';
export const TIMESTAMP = 1797000001000;
export const COMMAND_NAME = 'upgrade:2-4:migrate-to-billing-v2';
export const COMMAND_DESCRIPTION =
  'No-op: all workspaces are now on the resource-credit billing model';

export type MigrateToBillingV2Args = {
  workspaceId: string;
};

/**
 * No-op: every workspace is already on the resource-credit billing model.
 * Retained for upgrade-registry completeness.
 */
export async function migrateToBillingV2({
  workspaceId,
}: MigrateToBillingV2Args): Promise<void> {
  console.debug(
    `[${COMMAND_NAME}] Workspace ${workspaceId}: already on resource-credit billing, nothing to do`,
  );
}
