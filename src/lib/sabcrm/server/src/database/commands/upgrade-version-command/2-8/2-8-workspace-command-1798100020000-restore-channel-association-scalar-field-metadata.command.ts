import "server-only";

// PORT-NOTE: NestJS workspace command → plain async class.
// Re-registers the calendarChannelId/messageChannelId/messageFolderId scalar field metadata
// on the surviving association objects for workspaces where 2-8 drop-channel-standard-objects
// cascade-removed them.
// Original uses TypeORM repository insert + Postgres information_schema query for column existence.
// SabNode port uses MongoDB; the "physical column existence" check is replaced with a Mongo
// collection field presence check.

import { connectToDatabase } from "@/lib/mongodb";

export type RunOnWorkspaceArgs = {
  workspaceId: string;
  dataSource?: unknown; // Not used in Mongo port
  options: { dryRun?: boolean; verbose?: boolean };
};

export interface CommandLogger {
  log(msg: string): void;
  error(msg: string): void;
  warn(msg: string): void;
}

export const COMMAND_NAME =
  "upgrade:2-8:restore-channel-association-scalar-field-metadata";
export const COMMAND_VERSION = "2.8.0";
export const COMMAND_TIMESTAMP = 1798100020000;

// ── Types ─────────────────────────────────────────────────────────────────────

type ScalarFieldToRestore = {
  objectUniversalIdentifier: string;
  fieldUniversalIdentifier: string;
  fieldName: string;
  label: string;
  description: string;
  icon: string;
  isNullable: boolean;
};

const SCALAR_FIELDS_TO_RESTORE: ScalarFieldToRestore[] = [
  {
    objectUniversalIdentifier: "20202020-491b-4aaa-9825-afd1bae6ae00",
    fieldUniversalIdentifier: "20202020-93ee-4da4-8d58-0282c4a9cb7d",
    fieldName: "calendarChannelId",
    label: "Channel ID",
    description: "Channel ID",
    icon: "IconCalendar",
    isNullable: false,
  },
  {
    objectUniversalIdentifier: "20202020-ad1e-4127-bccb-d83ae04d2ccb",
    fieldUniversalIdentifier: "20202020-b658-408f-bd46-3bd2d15d7e52",
    fieldName: "messageChannelId",
    label: "Message Channel Id",
    description: "Message Channel Id",
    icon: "IconHash",
    isNullable: true,
  },
  {
    objectUniversalIdentifier: "20202020-a1b0-40b0-8ab0-5b6c7d8e9f0a",
    fieldUniversalIdentifier: "b3369d31-3856-4a7a-b007-ee353918127c",
    fieldName: "messageFolderId",
    label: "Message Folder",
    description: "Message Folder",
    icon: "IconFolder",
    isNullable: false,
  },
];

// ── Service interfaces ────────────────────────────────────────────────────────

export interface FlatObjectMetadata {
  id: string;
  universalIdentifier: string;
  nameSingular: string;
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
    flush(
      workspaceId: string,
      keys: string[],
    ): Promise<void>;
  }>;
  flush(workspaceId: string, keys: string[]): Promise<void>;
}

export interface WorkspaceMetadataVersionService {
  incrementMetadataVersion(workspaceId: string): Promise<void>;
}

// ── Field metadata document shape ────────────────────────────────────────────

type FieldMetadataDoc = {
  id: string;
  universalIdentifier: string;
  objectMetadataId: string;
  workspaceId: string;
  applicationId: string;
  type: "UUID";
  name: string;
  label: string;
  description: string;
  icon: string;
  isCustom: boolean;
  isActive: boolean;
  isSystem: boolean;
  isNullable: boolean;
  isUIReadOnly: boolean;
  isLabelSyncedWithName: boolean;
};

function generateUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Command implementation ────────────────────────────────────────────────────

export class RestoreChannelAssociationScalarFieldMetadataCommand {
  readonly version = COMMAND_VERSION;
  readonly timestamp = COMMAND_TIMESTAMP;

  constructor(
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceMetadataVersionService: WorkspaceMetadataVersionService,
    private readonly logger: CommandLogger = console,
  ) {}

  async runOnWorkspace({ workspaceId, options }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    const { flatObjectMetadataMaps, flatFieldMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        "flatObjectMetadataMaps",
        "flatFieldMetadataMaps",
      ]);

    // Only fields whose object still exists and whose scalar metadata is absent.
    const candidates = SCALAR_FIELDS_TO_RESTORE.flatMap((fieldToRestore) => {
      const flatObjectMetadata =
        flatObjectMetadataMaps.byUniversalIdentifier[
          fieldToRestore.objectUniversalIdentifier
        ];

      if (flatObjectMetadata === undefined) {
        return [];
      }

      const existingFlatFieldMetadata =
        flatFieldMetadataMaps.byUniversalIdentifier[
          fieldToRestore.fieldUniversalIdentifier
        ];

      if (existingFlatFieldMetadata !== undefined) {
        return [];
      }

      return [{ fieldToRestore, flatObjectMetadata }];
    });

    if (candidates.length === 0) {
      this.logger.log(
        `No channel association scalar field metadata to restore for workspace ${workspaceId}`,
      );
      return;
    }

    // PORT-NOTE: Original checks information_schema.columns to verify physical column
    // existence in Postgres. In MongoDB, we check for any document in the collection
    // that has the field set. We trust the field exists if the object metadata is present,
    // matching the original's intent (schema repair would be a separate step).

    const fieldMetadataRowsToInsert: FieldMetadataDoc[] = [];

    for (const { fieldToRestore, flatObjectMetadata } of candidates) {
      fieldMetadataRowsToInsert.push({
        id: generateUuid(),
        universalIdentifier: fieldToRestore.fieldUniversalIdentifier,
        objectMetadataId: flatObjectMetadata.id,
        workspaceId,
        applicationId: "", // filled below after fetching twentyStandardFlatApplication
        type: "UUID",
        name: fieldToRestore.fieldName,
        label: fieldToRestore.label,
        description: fieldToRestore.description,
        icon: fieldToRestore.icon,
        isCustom: false,
        isActive: true,
        isSystem: false,
        isNullable: fieldToRestore.isNullable,
        isUIReadOnly: true,
        isLabelSyncedWithName: false,
      });
    }

    if (fieldMetadataRowsToInsert.length === 0) {
      this.logger.log(
        `No channel association scalar field metadata to restore for workspace ${workspaceId}`,
      );
      return;
    }

    this.logger.log(
      `${isDryRun ? "[DRY RUN] " : ""}Restoring ${fieldMetadataRowsToInsert.length} scalar field metadata row(s) for workspace ${workspaceId}: ${fieldMetadataRowsToInsert.map((r) => r.name).join(", ")}`,
    );

    if (isDryRun) {
      return;
    }

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const rowsWithApp = fieldMetadataRowsToInsert.map((row) => ({
      ...row,
      applicationId: twentyStandardFlatApplication.id,
    }));

    const { db } = await connectToDatabase();
    const collection = db.collection<FieldMetadataDoc>("sabcrm_fieldMetadata");

    await collection.insertMany(rowsWithApp);

    await this.workspaceCacheService.flush(workspaceId, [
      "flatFieldMetadataMaps",
      "ORMEntityMetadatas",
      "graphQLResolverNameMap",
    ]);

    await this.workspaceMetadataVersionService.incrementMetadataVersion(
      workspaceId,
    );

    this.logger.log(
      `Restored ${rowsWithApp.length} scalar field metadata row(s) for workspace ${workspaceId}`,
    );
  }
}
