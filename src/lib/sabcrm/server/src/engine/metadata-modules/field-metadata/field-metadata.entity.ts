import "server-only";

// PORT-NOTE: TypeORM @Entity / @Column decorators removed.  This module
// exports the TypeScript document type and a typed MongoDB collection accessor.
// Collection name: sabcrm_field_metadata

import { Collection, type Document, ObjectId } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";

import { type AssignIfIsGivenFieldMetadataType } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/types/assign-if-is-given-field-metadata-type.type";
import { type AssignTypeIfIsMorphOrRelationFieldMetadataType } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/types/assign-type-if-is-morph-or-relation-field-metadata-type.type";

// Re-export shared enums / types so consumers import from a single location.
export type {
  FieldMetadataDefaultValue,
  FieldMetadataOptions,
  FieldMetadataSettings,
  FieldMetadataType,
} from "twenty-shared/types";

// ---------------------------------------------------------------------------
// Field-standard-overrides shape (mirrors FieldStandardOverridesDTO)
// ---------------------------------------------------------------------------
export type FieldStandardOverridesDTO = {
  label?: string | null;
  description?: string | null;
  icon?: string | null;
};

// ---------------------------------------------------------------------------
// Document type
// ---------------------------------------------------------------------------

/**
 * Represents one document in the `sabcrm_field_metadata` MongoDB collection.
 *
 * Relation fields (RELATION / MORPH_RELATION) carry the target ids;
 * for other types those fields resolve to `never | null` via the conditional
 * type helpers imported above.
 */
export type FieldMetadataDocument<
  TFieldMetadataType extends string = string,
> = Document & {
  _id: ObjectId;

  /** UUID string — the stable public ID used across the API */
  id: string;

  objectMetadataId: string;

  type: TFieldMetadataType;

  name: string;

  label: string;

  defaultValue: unknown | null;

  description: string | null;

  icon: string | null;

  standardOverrides: FieldStandardOverridesDTO | null;

  options: unknown | null;

  settings: unknown | null;

  isCustom: boolean;

  isActive: boolean;

  isSystem: boolean;

  isUIReadOnly: boolean;

  isNullable: boolean | null;

  /**
   * Derived field — not stored in Mongo.  Callers compute it from the
   * existence of a single-field UNIQUE index covering this field.
   */
  isUnique: boolean | null;

  isLabelSyncedWithName: boolean;

  // Relation-specific ids — null / never for non-relation types
  relationTargetFieldMetadataId: AssignTypeIfIsMorphOrRelationFieldMetadataType<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >;
  relationTargetObjectMetadataId: AssignTypeIfIsMorphOrRelationFieldMetadataType<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >;

  // MORPH_RELATION-specific: the polymorphic discriminator id
  morphId: AssignIfIsGivenFieldMetadataType<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >;

  // SyncableEntity fields (universalIdentifier, applicationId, workspaceId)
  universalIdentifier: string;
  applicationId: string | null;
  workspaceId: string;

  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Collection accessor
// ---------------------------------------------------------------------------

const COLLECTION_NAME = "sabcrm_field_metadata";

export async function getFieldMetadataCollection(): Promise<
  Collection<FieldMetadataDocument>
> {
  const db = await connectToDatabase();
  return db.collection<FieldMetadataDocument>(COLLECTION_NAME);
}

// ---------------------------------------------------------------------------
// Index helpers (call once at app start / migration time)
// ---------------------------------------------------------------------------

export async function ensureFieldMetadataIndexes(): Promise<void> {
  const col = await getFieldMetadataCollection();

  await Promise.all([
    // Mirrors @Unique constraint in original entity
    col.createIndex(
      { name: 1, objectMetadataId: 1, workspaceId: 1 },
      { unique: true, name: "IDX_FIELD_METADATA_NAME_OBJECT_METADATA_ID_WORKSPACE_ID_UNIQUE" },
    ),
    col.createIndex(
      { objectMetadataId: 1, workspaceId: 1 },
      { name: "IDX_FIELD_METADATA_OBJECT_METADATA_ID_WORKSPACE_ID" },
    ),
    col.createIndex(
      { workspaceId: 1 },
      { name: "IDX_FIELD_METADATA_WORKSPACE_ID" },
    ),
    col.createIndex(
      { relationTargetFieldMetadataId: 1 },
      {
        sparse: true,
        name: "IDX_FIELD_METADATA_RELATION_TARGET_FIELD_METADATA_ID",
      },
    ),
    col.createIndex(
      { relationTargetObjectMetadataId: 1 },
      {
        sparse: true,
        name: "IDX_FIELD_METADATA_RELATION_TARGET_OBJECT_METADATA_ID",
      },
    ),
  ]);
}
