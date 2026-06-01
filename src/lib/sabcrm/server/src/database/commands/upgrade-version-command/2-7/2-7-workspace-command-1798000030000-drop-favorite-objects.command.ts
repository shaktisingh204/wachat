import "server-only";

// PORT-NOTE: NestJS workspace command → plain async class.
// Drops legacy "favorite" and "favoriteFolder" object metadata entries from all workspaces.
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

export const COMMAND_NAME = "upgrade:2-7:drop-favorite-objects";
export const COMMAND_VERSION = "2.7.0";
export const COMMAND_TIMESTAMP = 1798000030000;

// Hard-coded because the matching STANDARD_OBJECTS entries no longer exist
// in twenty-shared after the favorite → navigationMenuItem migration.
const FAVORITE_OBJECT_UNIVERSAL_IDENTIFIER =
  "20202020-ab56-4e05-92a3-e2414a499860";
const FAVORITE_FOLDER_OBJECT_UNIVERSAL_IDENTIFIER =
  "20202020-7cf8-401f-8211-a9587d27fd2d";

// favorite has a relation to favoriteFolder, so it must be deleted first to
// avoid leaving dangling relation fields when favoriteFolder is dropped.
const LEGACY_FAVORITE_OBJECTS: Array<{
  universalIdentifier: string;
  label: string;
}> = [
  {
    universalIdentifier: FAVORITE_OBJECT_UNIVERSAL_IDENTIFIER,
    label: "favorite",
  },
  {
    universalIdentifier: FAVORITE_FOLDER_OBJECT_UNIVERSAL_IDENTIFIER,
    label: "favoriteFolder",
  },
];

// ── Service interfaces ────────────────────────────────────────────────────────

export interface FlatObjectMetadata {
  id: string;
  universalIdentifier: string;
  nameSingular: string;
  [key: string]: unknown;
}

export interface FlatEntityMaps {
  byUniversalIdentifier: Record<string, FlatObjectMetadata | undefined>;
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
    flatObjectMetadataMaps: FlatEntityMaps;
  }>;
}

export interface ObjectMetadataService {
  deleteOneObject(args: {
    deleteObjectInput: { id: string };
    workspaceId: string;
    isSystemBuild: boolean;
    ownerFlatApplication: { id: string; universalIdentifier: string };
  }): Promise<void>;
}

// ── Command implementation ────────────────────────────────────────────────────

export class DropFavoriteObjectsCommand {
  readonly version = COMMAND_VERSION;
  readonly timestamp = COMMAND_TIMESTAMP;

  constructor(
    private readonly applicationService: ApplicationService,
    private readonly objectMetadataService: ObjectMetadataService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly logger: CommandLogger = console,
  ) {}

  async runOnWorkspace({ workspaceId, options }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? "[DRY RUN] " : ""}Starting legacy favorite objects removal for workspace ${workspaceId}`,
    );

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const { flatObjectMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        "flatObjectMetadataMaps",
      ]);

    for (const { universalIdentifier, label } of LEGACY_FAVORITE_OBJECTS) {
      const flatObjectMetadata =
        flatObjectMetadataMaps.byUniversalIdentifier[universalIdentifier];

      if (flatObjectMetadata === undefined) {
        this.logger.log(
          `${label} object already absent for workspace ${workspaceId}`,
        );
        continue;
      }

      if (isDryRun) {
        this.logger.log(
          `[DRY RUN] Would delete ${label} object (id=${flatObjectMetadata.id}) for workspace ${workspaceId}`,
        );
        continue;
      }

      await this.objectMetadataService.deleteOneObject({
        deleteObjectInput: { id: flatObjectMetadata.id },
        workspaceId,
        isSystemBuild: true,
        ownerFlatApplication: twentyStandardFlatApplication,
      });

      this.logger.log(`Deleted ${label} object for workspace ${workspaceId}`);
    }
  }
}
