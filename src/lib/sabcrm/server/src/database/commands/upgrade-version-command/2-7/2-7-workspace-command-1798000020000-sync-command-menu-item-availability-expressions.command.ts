import "server-only";

// PORT-NOTE: NestJS workspace command → plain async function / class.
// Original command iterates all active/suspended workspaces and re-syncs
// conditionalAvailabilityExpression on standard command menu items.
// The NestJS decorator @RegisteredWorkspaceCommand and @Command are dropped;
// business logic is preserved as an exported plain class + function.

export type RunOnWorkspaceArgs = {
  workspaceId: string;
  options: { dryRun?: boolean; verbose?: boolean };
};

// Minimal logger interface matching the original CommandLogger contract.
export interface CommandLogger {
  log(msg: string): void;
  error(msg: string): void;
  warn(msg: string): void;
}

export const COMMAND_NAME =
  "upgrade:2-7:sync-command-menu-item-availability-expressions";
export const COMMAND_VERSION = "2.7.0";
export const COMMAND_TIMESTAMP = 1798000020000;

// ── Service interfaces (inject real implementations at call-site) ────────────

export interface ApplicationService {
  findWorkspaceTwentyStandardAndCustomApplicationOrThrow(args: {
    workspaceId: string;
  }): Promise<{
    twentyStandardFlatApplication: {
      id: string;
      universalIdentifier: string;
    };
  }>;
}

export interface WorkspaceCacheService {
  getOrRecompute(
    workspaceId: string,
    keys: string[],
  ): Promise<{
    flatCommandMenuItemMaps: {
      byUniversalIdentifier: Record<
        string,
        | {
            universalIdentifier: string;
            conditionalAvailabilityExpression?: string;
            updatedAt?: string;
            [key: string]: unknown;
          }
        | undefined
      >;
    };
  }>;
}

export interface WorkspaceMigrationValidateBuildAndRunService {
  validateBuildAndRunWorkspaceMigration(args: {
    allFlatEntityOperationByMetadataName: Record<
      string,
      {
        flatEntityToCreate: unknown[];
        flatEntityToDelete: unknown[];
        flatEntityToUpdate: unknown[];
      }
    >;
    workspaceId: string;
    applicationUniversalIdentifier: string;
  }): Promise<{ status: "ok" | "fail"; [key: string]: unknown }>;
}

export interface StandardApplicationService {
  computeAllFlatEntityMaps(args: {
    now: string;
    workspaceId: string;
    twentyStandardApplicationId: string;
  }): {
    allFlatEntityMaps: {
      flatCommandMenuItemMaps: {
        byUniversalIdentifier: Record<
          string,
          | {
              universalIdentifier: string;
              conditionalAvailabilityExpression?: string;
              [key: string]: unknown;
            }
          | undefined
        >;
      };
    };
  };
}

// ── Command implementation ───────────────────────────────────────────────────

export class SyncCommandMenuItemAvailabilityExpressionsCommand {
  readonly version = COMMAND_VERSION;
  readonly timestamp = COMMAND_TIMESTAMP;

  constructor(
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
    private readonly standardApplicationService: StandardApplicationService,
    private readonly logger: CommandLogger = console,
  ) {}

  async runOnWorkspace({ workspaceId, options }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? "[DRY RUN] " : ""}Syncing command menu item availability expressions for workspace ${workspaceId}`,
    );

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const { flatCommandMenuItemMaps: existingFlatCommandMenuItemMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        "flatCommandMenuItemMaps",
      ]);

    const { allFlatEntityMaps: standardAllFlatEntityMaps } =
      this.standardApplicationService.computeAllFlatEntityMaps({
        now: new Date().toISOString(),
        workspaceId,
        twentyStandardApplicationId: twentyStandardFlatApplication.id,
      });

    const itemsToUpdate = Object.values(
      standardAllFlatEntityMaps.flatCommandMenuItemMaps.byUniversalIdentifier,
    )
      .filter((item): item is NonNullable<typeof item> => item !== undefined)
      .map((standardItem) => {
        const existingItem =
          existingFlatCommandMenuItemMaps.byUniversalIdentifier[
            standardItem.universalIdentifier
          ];

        if (
          existingItem === undefined ||
          existingItem.conditionalAvailabilityExpression ===
            standardItem.conditionalAvailabilityExpression
        ) {
          return undefined;
        }

        return {
          ...existingItem,
          conditionalAvailabilityExpression:
            standardItem.conditionalAvailabilityExpression,
          updatedAt: new Date().toISOString(),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== undefined);

    if (itemsToUpdate.length === 0) {
      this.logger.log(
        `Command menu item availability expressions already up to date for workspace ${workspaceId}`,
      );
      return;
    }

    this.logger.log(
      `Found ${itemsToUpdate.length} command menu item(s) with drifted availability expressions for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      this.logger.log(
        `[DRY RUN] Would sync ${itemsToUpdate.length} command menu item availability expression(s) for workspace ${workspaceId}`,
      );
      return;
    }

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
        {
          allFlatEntityOperationByMetadataName: {
            commandMenuItem: {
              flatEntityToCreate: [],
              flatEntityToDelete: [],
              flatEntityToUpdate: itemsToUpdate,
            },
          },
          workspaceId,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
        },
      );

    if (validateAndBuildResult.status === "fail") {
      this.logger.error(
        `Failed to sync command menu item availability expressions:\n${JSON.stringify(validateAndBuildResult, null, 2)}`,
      );
      throw new Error(
        `Failed to sync command menu item availability expressions for workspace ${workspaceId}`,
      );
    }

    this.logger.log(
      `Successfully synced ${itemsToUpdate.length} command menu item availability expression(s) for workspace ${workspaceId}`,
    );
  }
}
