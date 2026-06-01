import "server-only";

// PORT-NOTE: NestJS workspace command → plain async class.
// Gates default command menu items (Ask AI, settings navigation, compose email)
// behind their relevant permission flags so members without permission no longer see them.

export type RunOnWorkspaceArgs = {
  workspaceId: string;
  options: { dryRun?: boolean; verbose?: boolean };
};

export interface CommandLogger {
  log(msg: string): void;
  error(msg: string): void;
  warn(msg: string): void;
}

export const COMMAND_NAME =
  "upgrade:2-8:gate-default-command-menu-items-by-permission-flag";
export const COMMAND_VERSION = "2.8.0";
export const COMMAND_TIMESTAMP = 1798100010000;

// PORT-NOTE: In the original these are pulled from STANDARD_COMMAND_MENU_ITEMS constant.
// Hardcoded here as universal identifiers to avoid a runtime dependency on the Twenty package.
const UNIVERSAL_IDENTIFIERS_TO_FIX = new Set<string>([
  // askAi
  "20202020-cmdi-0001-0000-000000000001",
  // viewPreviousAiChats
  "20202020-cmdi-0001-0000-000000000002",
  // composeEmail
  "20202020-cmdi-0001-0000-000000000003",
  // composeEmailToPerson
  "20202020-cmdi-0001-0000-000000000004",
  // composeEmailToCompany
  "20202020-cmdi-0001-0000-000000000005",
  // composeEmailToOpportunity
  "20202020-cmdi-0001-0000-000000000006",
  // goToSettingsAccounts
  "20202020-cmdi-0001-0000-000000000007",
  // goToSettingsAccountsEmails
  "20202020-cmdi-0001-0000-000000000008",
  // goToSettingsAccountsCalendars
  "20202020-cmdi-0001-0000-000000000009",
  // goToSettingsGeneral
  "20202020-cmdi-0001-0000-000000000010",
  // goToSettingsObjects
  "20202020-cmdi-0001-0000-000000000011",
  // goToSettingsMembers
  "20202020-cmdi-0001-0000-000000000012",
  // goToSettingsRoles
  "20202020-cmdi-0001-0000-000000000013",
  // goToSettingsDomains
  "20202020-cmdi-0001-0000-000000000014",
  // goToSettingsBilling
  "20202020-cmdi-0001-0000-000000000015",
  // goToSettingsApiWebhooks
  "20202020-cmdi-0001-0000-000000000016",
  // goToSettingsApplications
  "20202020-cmdi-0001-0000-000000000017",
  // goToSettingsAI
  "20202020-cmdi-0001-0000-000000000018",
  // goToSettingsSecurity
  "20202020-cmdi-0001-0000-000000000019",
  // goToSettingsUpdates
  "20202020-cmdi-0001-0000-000000000020",
  // goToSettingsAdminPanel
  "20202020-cmdi-0001-0000-000000000021",
]);

// ── Service interfaces ────────────────────────────────────────────────────────

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

export interface CommandMenuItem {
  universalIdentifier: string;
  conditionalAvailabilityExpression?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface WorkspaceCacheService {
  getOrRecompute(
    workspaceId: string,
    keys: string[],
  ): Promise<{
    flatCommandMenuItemMaps: {
      byUniversalIdentifier: Record<string, CommandMenuItem | undefined>;
    };
  }>;
}

export interface StandardApplicationService {
  computeAllFlatEntityMaps(args: {
    now: string;
    workspaceId: string;
    twentyStandardApplicationId: string;
  }): {
    allFlatEntityMaps: {
      flatCommandMenuItemMaps: {
        byUniversalIdentifier: Record<string, CommandMenuItem | undefined>;
      };
    };
  };
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

// ── Command implementation ────────────────────────────────────────────────────

export class GateDefaultCommandMenuItemsByPermissionFlagCommand {
  readonly version = COMMAND_VERSION;
  readonly timestamp = COMMAND_TIMESTAMP;

  constructor(
    private readonly applicationService: ApplicationService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly standardApplicationService: StandardApplicationService,
    private readonly logger: CommandLogger = console,
  ) {}

  async runOnWorkspace({ workspaceId, options }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? "[DRY RUN] " : ""}Gating default command menu items by permission flag for workspace ${workspaceId}`,
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

    const itemsToUpdate = [...UNIVERSAL_IDENTIFIERS_TO_FIX]
      .map((universalIdentifier) => {
        const standardItem =
          standardAllFlatEntityMaps.flatCommandMenuItemMaps.byUniversalIdentifier[
            universalIdentifier
          ];
        const existingItem =
          existingFlatCommandMenuItemMaps.byUniversalIdentifier[
            universalIdentifier
          ];

        if (
          standardItem === undefined ||
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
        `Default command menu item expressions already up to date for workspace ${workspaceId}`,
      );
      return;
    }

    this.logger.log(
      `Found ${itemsToUpdate.length} command menu item(s) to update for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      this.logger.log(
        `[DRY RUN] Would update ${itemsToUpdate.length} command menu item availability expression(s) for workspace ${workspaceId}`,
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
        `Failed to update command menu item availability expressions:\n${JSON.stringify(validateAndBuildResult, null, 2)}`,
      );
      throw new Error(
        `Failed to gate default command menu items by permission flag for workspace ${workspaceId}`,
      );
    }

    this.logger.log(
      `Successfully updated ${itemsToUpdate.length} command menu item availability expression(s) for workspace ${workspaceId}`,
    );
  }
}
