// PORT-NOTE: TypeORM entity types replaced with Mongo document types.
// FieldMetadataDTO is defined inline here (the DTO class is in the same
// sub-package; import from the ported DTO path if/when that file is ported).
// Logic ported verbatim.

import { type FieldMetadataDocument } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/field-metadata.entity";

// Minimal FieldMetadataDTO shape (mirrors the original NestJS DTO)
export type FieldMetadataDTO = {
  id: string;
  universalIdentifier: string;
  applicationId: string | null | undefined;
  type: string;
  name: string;
  label: string;
  description: string | undefined;
  icon: string | undefined;
  standardOverrides: unknown | undefined;
  isCustom: boolean;
  isActive: boolean;
  isSystem: boolean;
  isUIReadOnly: boolean;
  isNullable: boolean;
  isUnique: boolean;
  defaultValue: unknown | undefined;
  options: unknown | undefined;
  settings: unknown | undefined;
  workspaceId: string;
  objectMetadataId: string;
  isLabelSyncedWithName: boolean;
  morphId: string | null | undefined;
  createdAt: Date;
  updatedAt: Date;
};

// isUnique is derived from IndexMetadata rather than stored on the document;
// callers that need an accurate value pass the precomputed Set<fieldMetadataId>.
export const fromFieldMetadataEntityToFieldMetadataDto = (
  entity: FieldMetadataDocument,
  uniqueFieldMetadataIds?: ReadonlySet<string>,
): FieldMetadataDTO => ({
  id: entity.id,
  universalIdentifier: entity.universalIdentifier,
  applicationId: entity.applicationId ?? undefined,
  type: entity.type,
  name: entity.name,
  label: entity.label,
  description: entity.description ?? undefined,
  icon: entity.icon ?? undefined,
  standardOverrides: entity.standardOverrides ?? undefined,
  isCustom: entity.isCustom,
  isActive: entity.isActive,
  isSystem: entity.isSystem,
  isUIReadOnly: entity.isUIReadOnly,
  isNullable: entity.isNullable ?? false,
  isUnique: uniqueFieldMetadataIds?.has(entity.id) ?? false,
  defaultValue: entity.defaultValue ?? undefined,
  options: entity.options ?? undefined,
  settings: entity.settings ?? undefined,
  workspaceId: entity.workspaceId,
  objectMetadataId: entity.objectMetadataId,
  isLabelSyncedWithName: entity.isLabelSyncedWithName,
  morphId: (entity.morphId as string | null | undefined) ?? undefined,
  createdAt: entity.createdAt,
  updatedAt: entity.updatedAt,
});
