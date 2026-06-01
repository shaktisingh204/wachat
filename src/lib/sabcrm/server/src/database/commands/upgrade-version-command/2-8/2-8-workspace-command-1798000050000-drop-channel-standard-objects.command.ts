import "server-only";

// PORT-NOTE: NestJS workspace command → plain async class.
// Drops calendarChannel, messageChannel, messageFolder standard objects from workspace schemas
// (moved to core metadata).

export type RunOnWorkspaceArgs = {
  workspaceId: string;
  options: { dryRun?: boolean; verbose?: boolean };
};

export interface CommandLogger {
  log(msg: string): void;
  error(msg: string): void;
  warn(msg: string): void;
}

export const COMMAND_NAME = "upgrade:2-8:drop-channel-standard-objects";
export const COMMAND_VERSION = "2.8.0";
export const COMMAND_TIMESTAMP = 1798000050000;

const CALENDAR_CHANNEL_OBJECT_UNIVERSAL_IDENTIFIER =
  "20202020-e8f2-40e1-a39c-c0e0039c5034";

const MESSAGE_CHANNEL_OBJECT_UNIVERSAL_IDENTIFIER =
  "20202020-fe8c-40bc-a681-b80b771449b7";

const MESSAGE_FOLDER_OBJECT_UNIVERSAL_IDENTIFIER =
  "20202020-4955-4fd9-8e59-2dbd373f2a46";

const OBJECT_UNIVERSAL_IDENTIFIERS = [
  CALENDAR_CHANNEL_OBJECT_UNIVERSAL_IDENTIFIER,
  MESSAGE_CHANNEL_OBJECT_UNIVERSAL_IDENTIFIER,
  MESSAGE_FOLDER_OBJECT_UNIVERSAL_IDENTIFIER,
] as const;

// ── Service interfaces ────────────────────────────────────────────────────────

export interface FlatObjectMetadata {
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

export class DropChannelStandardObjectsCommand {
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
      `${isDryRun ? "[DRY RUN] " : ""}Starting channel standard objects removal for workspace ${workspaceId}`,
    );

    const { flatObjectMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        "flatObjectMetadataMaps",
      ]);

    const objectsToDelete = OBJECT_UNIVERSAL_IDENTIFIERS.map((uid) =>
      flatObjectMetadataMaps.byUniversalIdentifier[uid],
    ).filter((obj): obj is FlatObjectMetadata => obj !== undefined);

    if (objectsToDelete.length === 0) {
      this.logger.log(
        `Channel standard objects already absent for workspace ${workspaceId}`,
      );
      return;
    }

    if (isDryRun) {
      this.logger.log(
        `[DRY RUN] Would delete ${objectsToDelete.length} channel standard objects for workspace ${workspaceId}`,
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
            objectMetadata: {
              flatEntityToCreate: [],
              flatEntityToDelete: objectsToDelete,
              flatEntityToUpdate: [],
            },
          },
          workspaceId,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
        },
      );

    if (validateAndBuildResult.status === "fail") {
      this.logger.error(
        `Failed to delete channel standard objects:\n${JSON.stringify(validateAndBuildResult, null, 2)}`,
      );
      throw new Error(
        `Failed to delete channel standard objects for workspace ${workspaceId}`,
      );
    }

    this.logger.log(
      `Deleted ${objectsToDelete.length} channel standard objects for workspace ${workspaceId}`,
    );
  }
}
