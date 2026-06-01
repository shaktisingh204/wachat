import "server-only";

// PORT-NOTE: NestJS workspace command → plain async class.
// Drops the connectedAccount standard object from workspace schemas (moved to core metadata).
// The NestJS @RegisteredWorkspaceCommand / @Command decorators are dropped;
// business logic is preserved faithfully.

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
  "upgrade:2-7:drop-connected-account-standard-object";
export const COMMAND_VERSION = "2.7.0";
export const COMMAND_TIMESTAMP = 1798000040000;

const CONNECTED_ACCOUNT_OBJECT_UNIVERSAL_IDENTIFIER =
  "20202020-977e-46b2-890b-c3002ddfd5c5";

const WORKSPACE_MEMBER_CONNECTED_ACCOUNTS_FIELD_UNIVERSAL_IDENTIFIER =
  "20202020-e322-4bde-a525-727079b4a100";

const MESSAGE_CHANNEL_CONNECTED_ACCOUNT_FIELD_UNIVERSAL_IDENTIFIER =
  "20202020-49a2-44a4-b470-282c0440d15d";

const CALENDAR_CHANNEL_CONNECTED_ACCOUNT_FIELD_UNIVERSAL_IDENTIFIER =
  "20202020-95b1-4f44-82dc-61b042ae2414";

// ── Service interfaces ────────────────────────────────────────────────────────

export interface FlatObjectMetadata {
  id: string;
  universalIdentifier: string;
  [key: string]: unknown;
}

export interface FlatFieldMetadata {
  id: string;
  universalIdentifier: string;
  [key: string]: unknown;
}

export interface FlatEntityMaps<T> {
  byUniversalIdentifier: Record<string, T | undefined>;
  [key: string]: unknown;
}

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
    flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
    flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  }>;
}

export interface WorkspaceMigrationValidateBuildAndRunService {
  validateBuildAndRunWorkspaceMigration(args: {
    isSystemBuild: boolean;
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

export class DropConnectedAccountStandardObjectCommand {
  readonly version = COMMAND_VERSION;
  readonly timestamp = COMMAND_TIMESTAMP;

  constructor(
    private readonly applicationService: ApplicationService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly logger: CommandLogger = console,
  ) {}

  async runOnWorkspace({ workspaceId, options }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? "[DRY RUN] " : ""}Starting connectedAccount standard object removal for workspace ${workspaceId}`,
    );

    const { flatObjectMetadataMaps, flatFieldMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        "flatObjectMetadataMaps",
        "flatFieldMetadataMaps",
      ]);

    const connectedAccountObjectMetadata =
      flatObjectMetadataMaps.byUniversalIdentifier[
        CONNECTED_ACCOUNT_OBJECT_UNIVERSAL_IDENTIFIER
      ] ?? null;

    const relationFieldsToDelete = [
      WORKSPACE_MEMBER_CONNECTED_ACCOUNTS_FIELD_UNIVERSAL_IDENTIFIER,
      MESSAGE_CHANNEL_CONNECTED_ACCOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      CALENDAR_CHANNEL_CONNECTED_ACCOUNT_FIELD_UNIVERSAL_IDENTIFIER,
    ]
      .map((uid) => flatFieldMetadataMaps.byUniversalIdentifier[uid])
      .filter((field): field is FlatFieldMetadata => field !== undefined);

    if (!connectedAccountObjectMetadata && relationFieldsToDelete.length === 0) {
      this.logger.log(
        `connectedAccount standard object already absent for workspace ${workspaceId}`,
      );
      return;
    }

    if (isDryRun) {
      this.logger.log(
        `[DRY RUN] Would delete connectedAccount standard object and ${relationFieldsToDelete.length} relation fields for workspace ${workspaceId}`,
      );
      return;
    }

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
        {
          isSystemBuild: true,
          allFlatEntityOperationByMetadataName: {
            ...(connectedAccountObjectMetadata
              ? {
                  objectMetadata: {
                    flatEntityToCreate: [],
                    flatEntityToDelete: [connectedAccountObjectMetadata],
                    flatEntityToUpdate: [],
                  },
                }
              : {}),
            ...(relationFieldsToDelete.length > 0
              ? {
                  fieldMetadata: {
                    flatEntityToCreate: [],
                    flatEntityToDelete: relationFieldsToDelete,
                    flatEntityToUpdate: [],
                  },
                }
              : {}),
          },
          workspaceId,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
        },
      );

    if (validateAndBuildResult.status === "fail") {
      this.logger.error(
        `Failed to delete connectedAccount standard object:\n${JSON.stringify(validateAndBuildResult, null, 2)}`,
      );
      throw new Error(
        `Failed to delete connectedAccount standard object for workspace ${workspaceId}`,
      );
    }

    this.logger.log(
      `Deleted connectedAccount standard object and relation fields for workspace ${workspaceId}`,
    );
  }
}
