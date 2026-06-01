import "server-only";

// PORT-NOTE: This was a NestJS nest-commander workspace command that:
//   - Iterated over all active/suspended workspaces
//   - For each workspace: found composite-type fields whose defaultValue
//     contained empty-string sub-properties, normalized them to null via
//     WorkspaceMigrationValidateBuildAndRunService, and backfilled workspace
//     table rows with NULL using a per-workspace TypeORM DataSource.
//
// This command depends on NestJS DI services
// (WorkspaceCacheService, WorkspaceMigrationValidateBuildAndRunService)
// and on a per-workspace Postgres DataSource — none of which exist in
// SabNode's MongoDB stack. Full re-implementation requires porting those
// services, which is out of scope for this migration command file.
//
// The function is exported as a stub so the module registry compiles.

export const VERSION = '2.5.0';
export const TIMESTAMP = 1778000001000;
export const COMMAND_NAME = 'upgrade:2-5:normalize-composite-field-defaults';
export const COMMAND_DESCRIPTION =
  'Normalize composite field default values: remove empty-string values from metadata and backfill workspace data with NULL.';

export type NormalizeCompositeFieldDefaultsArgs = {
  workspaceId: string;
  dryRun?: boolean;
};

/**
 * PORT-NOTE: Stub. The original logic relies on per-workspace TypeORM
 * DataSources, WorkspaceCacheService, and WorkspaceMigrationValidateBuildAndRunService
 * — none of which exist in the SabNode MongoDB stack. Implement if/when
 * workspace-level field-metadata management is ported.
 */
export async function normalizeCompositeFieldDefaults({
  workspaceId,
  dryRun = false,
}: NormalizeCompositeFieldDefaultsArgs): Promise<void> {
  console.warn(
    `[${COMMAND_NAME}] workspace=${workspaceId} dryRun=${dryRun}: ` +
      'Not implemented for MongoDB — requires porting WorkspaceCacheService and WorkspaceMigrationValidateBuildAndRunService.',
  );
}
