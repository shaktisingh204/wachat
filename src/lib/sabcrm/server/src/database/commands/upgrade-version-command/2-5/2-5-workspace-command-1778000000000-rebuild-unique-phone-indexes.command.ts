import "server-only";

// PORT-NOTE: This was a NestJS nest-commander workspace command that:
//   - Iterated over all active/suspended workspaces
//   - For each workspace: found unique PHONES-type indexes with legacy
//     non-empty partial WHERE clauses, cleared empty-string phone columns,
//     updated the indexWhereClause in metadata, dropped the old index, and
//     recreated it without the partial clause.
//
// This command depends heavily on NestJS DI services
// (WorkspaceCacheService, WorkspaceSchemaManagerService) and on a
// per-workspace Postgres DataSource created by TypeORM's multi-tenant
// schema system. It has no direct MongoDB analogue — SabNode does not
// replicate the Twenty workspace-per-schema Postgres architecture.
//
// The function is exported as a stub so the module registry compiles.
// Full re-implementation requires porting WorkspaceCacheService and
// WorkspaceSchemaManagerService to MongoDB, which is out of scope for this
// migration command file.

export const VERSION = '2.5.0';
export const TIMESTAMP = 1778000000000;
export const COMMAND_NAME = 'upgrade:2-5:rebuild-unique-phone-indexes';
export const COMMAND_DESCRIPTION =
  'Rebuild unique phone field indexes to include the phone calling code column.';

export type RebuildUniquePhoneIndexesArgs = {
  workspaceId: string;
  dryRun?: boolean;
};

/**
 * PORT-NOTE: Stub. The original logic relies on per-workspace TypeORM
 * DataSources, WorkspaceCacheService, and WorkspaceSchemaManagerService —
 * none of which exist in the SabNode MongoDB stack. Implement if/when
 * workspace-level index management is ported.
 */
export async function rebuildUniquePhoneIndexes({
  workspaceId,
  dryRun = false,
}: RebuildUniquePhoneIndexesArgs): Promise<void> {
  console.warn(
    `[${COMMAND_NAME}] workspace=${workspaceId} dryRun=${dryRun}: ` +
      'Not implemented for MongoDB — requires porting WorkspaceCacheService.',
  );
}
