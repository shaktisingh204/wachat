import 'server-only';

// PORT-NOTE: data-seed-dev-workspace.command.ts
// The original was a nest-commander @Command. In SabNode this becomes a plain
// async function callable from a script or a protected server action.
// DevSeederService must be ported separately; stub types are used here.

// Seed workspace IDs (inlined from the original constants).
export const SEED_APPLE_WORKSPACE_ID = '20202020-1c25-4d02-bf25-6aeccf7ea419';
export const SEED_YCOMBINATOR_WORKSPACE_ID = '20202020-7f91-4f6e-9be9-8ec5f2b49d99';
export const SEED_EMPTY_WORKSPACE_3_ID = '20202020-3333-3333-3333-000000000001';
export const SEED_EMPTY_WORKSPACE_4_ID = '20202020-4444-4444-4444-000000000001';

export type SeededWorkspacesIds =
  | typeof SEED_APPLE_WORKSPACE_ID
  | typeof SEED_YCOMBINATOR_WORKSPACE_ID;

export type SeededEmptyWorkspacesIds =
  | typeof SEED_EMPTY_WORKSPACE_3_ID
  | typeof SEED_EMPTY_WORKSPACE_4_ID;

export type DataSeedWorkspaceOptions = {
  /** If true, only seed the Apple workspace with minimal records. */
  light?: boolean;
};

/**
 * Seeds CRM workspaces with dev fixture data.
 * Requires a concrete DevSeederService implementation to be passed in.
 *
 * @param devSeederService - Object with seedDev / seedEmptyWorkspace methods.
 * @param options - Seed options.
 */
export async function dataSeedDevWorkspace(
  devSeederService: {
    seedDev: (workspaceId: string, opts: { light?: boolean }) => Promise<void>;
    seedEmptyWorkspace: (workspaceId: string) => Promise<void>;
  },
  options: DataSeedWorkspaceOptions = {},
): Promise<void> {
  const workspaceIds: SeededWorkspacesIds[] = options.light
    ? [SEED_APPLE_WORKSPACE_ID]
    : [SEED_APPLE_WORKSPACE_ID, SEED_YCOMBINATOR_WORKSPACE_ID];

  const emptyWorkspaceIds: SeededEmptyWorkspacesIds[] = options.light
    ? []
    : [SEED_EMPTY_WORKSPACE_3_ID, SEED_EMPTY_WORKSPACE_4_ID];

  for (const workspaceId of workspaceIds) {
    await devSeederService.seedDev(workspaceId, { light: options.light });
  }

  for (const workspaceId of emptyWorkspaceIds) {
    await devSeederService.seedEmptyWorkspace(workspaceId);
  }
}
