import "server-only";

// PORT-NOTE: NestJS workspace command → plain async class.
// Backfills missing BTREE indexes on target<X>Id join columns added to polymorphic
// standard objects (timelineActivity, attachment, noteTarget, taskTarget).
// Original command uses Postgres CONCURRENTLY index creation and TypeORM repository.
// In SabNode/MongoDB there are no SQL indexes of this type; see PORT-NOTEs inline.

export type RunOnWorkspaceArgs = {
  workspaceId: string;
  dataSource?: unknown; // Postgres DataSource — not used in Mongo port
  options: { dryRun?: boolean; verbose?: boolean };
};

export interface CommandLogger {
  log(msg: string): void;
  error(msg: string): void;
  warn(msg: string): void;
}

export const COMMAND_NAME =
  "upgrade:2-8:backfill-relation-join-column-indexes";
export const COMMAND_VERSION = "2.8.0";
export const COMMAND_TIMESTAMP = 1798100000000;

export type RelationType = "ONE_TO_MANY" | "MANY_TO_ONE" | "ONE_TO_ONE";

export interface FlatObjectMetadata {
  id: string;
  universalIdentifier: string;
  nameSingular: string;
  [key: string]: unknown;
}

export interface FlatFieldMetadata {
  id: string;
  objectMetadataId: string;
  universalIdentifier: string;
  name: string;
  settings?: { relationType?: RelationType; [key: string]: unknown };
  [key: string]: unknown;
}

export interface FlatIndexMetadata {
  name: string;
  isUnique: boolean;
  indexType?: string;
  indexWhereClause?: string | null;
  flatIndexFieldMetadatas: Array<{ fieldMetadataId: string }>;
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
    flatIndexMaps: FlatEntityMaps<FlatIndexMetadata>;
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

// Polymorphic standard object names from DEFAULT_RELATIONS_OBJECTS_STANDARD_IDS
// PORT-NOTE: The original set is derived from twenty-shared/metadata at runtime.
// Hardcoded here to avoid a runtime dependency on the Twenty package.
const POLYMORPHIC_STANDARD_OBJECT_NAMES_SINGULAR: ReadonlySet<string> =
  new Set(["timelineActivity", "attachment", "noteTarget", "taskTarget"]);

export class BackfillRelationJoinColumnIndexesCommand {
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

    // PORT-NOTE: The original command creates CONCURRENTLY Postgres indexes.
    // MongoDB does not use SQL join-column indexes. This command is a no-op in
    // the Mongo port; the equivalent would be creating compound indexes on the
    // sabcrm_* collections for the relevant join fields.
    this.logger.log(
      `${isDryRun ? "[DRY RUN] " : ""}BackfillRelationJoinColumnIndexesCommand — Postgres index creation is a no-op in SabNode/MongoDB. ` +
        `Workspace: ${workspaceId}. ` +
        `If needed, create compound indexes on sabcrm_timelineActivity, sabcrm_attachment, sabcrm_noteTarget, sabcrm_taskTarget manually.`,
    );

    const {
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      flatIndexMaps,
    } = await this.workspaceCacheService.getOrRecompute(workspaceId, [
      "flatObjectMetadataMaps",
      "flatFieldMetadataMaps",
      "flatIndexMaps",
    ]);

    const polymorphicStandardObjectIds = new Set(
      Object.values(flatObjectMetadataMaps.byUniversalIdentifier)
        .filter((obj): obj is FlatObjectMetadata => obj !== undefined)
        .filter((flatObject) =>
          POLYMORPHIC_STANDARD_OBJECT_NAMES_SINGULAR.has(
            flatObject.nameSingular,
          ),
        )
        .map((flatObject) => flatObject.id),
    );

    if (polymorphicStandardObjectIds.size === 0) {
      this.logger.log(
        `No polymorphic standard objects found for workspace ${workspaceId}, skipping`,
      );
      return;
    }

    const indexedFieldIds = new Set<string>();
    for (const flatIndex of Object.values(flatIndexMaps.byUniversalIdentifier)) {
      if (flatIndex === undefined) {
        continue;
      }
      for (const indexField of flatIndex.flatIndexFieldMetadatas) {
        indexedFieldIds.add(indexField.fieldMetadataId);
      }
    }

    const fieldsNeedingIndex = Object.values(
      flatFieldMetadataMaps.byUniversalIdentifier,
    )
      .filter((f): f is FlatFieldMetadata => f !== undefined)
      .filter(
        (flatField) =>
          polymorphicStandardObjectIds.has(flatField.objectMetadataId) &&
          flatField.settings?.relationType === "MANY_TO_ONE" &&
          !indexedFieldIds.has(flatField.id),
      );

    if (fieldsNeedingIndex.length === 0) {
      this.logger.log(
        `No missing relation join column indexes for workspace ${workspaceId}, skipping`,
      );
      return;
    }

    this.logger.log(
      `${isDryRun ? "[DRY RUN] " : ""}Found ${fieldsNeedingIndex.length} field(s) that would need Postgres CONCURRENTLY index creation for workspace ${workspaceId}: ${fieldsNeedingIndex.map((f) => f.name).join(", ")}. ` +
        `PORT-NOTE: Skipped — MongoDB does not use SQL join-column indexes.`,
    );

    if (isDryRun) {
      return;
    }

    // PORT-NOTE: Skip actual index creation — no Postgres DataSource in SabNode.
    // The metadata update step is also skipped because the index metadata only
    // makes sense in the Postgres context.
    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    this.logger.log(
      `BackfillRelationJoinColumnIndexesCommand completed (no-op in MongoDB) for workspace ${workspaceId} / app ${twentyStandardFlatApplication.id}`,
    );
  }
}
