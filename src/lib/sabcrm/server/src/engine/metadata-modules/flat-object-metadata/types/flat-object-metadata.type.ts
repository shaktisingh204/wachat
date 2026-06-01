// PORT-NOTE: FlatObjectMetadata is derived from ObjectMetadataEntity via FlatEntityFrom in Twenty.
// Ported as a plain structural type covering all fields used across the query processors.

export type FlatObjectMetadata = {
  id: string;
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  description: string | null;
  icon: string | null;
  targetTableName: string;
  isCustom: boolean;
  isRemote: boolean;
  isActive: boolean;
  isSystem: boolean;
  isAuditLogged: boolean;
  isSearchable: boolean;
  isLabelSyncedWithName: boolean;
  // Array of field ids belonging to this object
  fieldIds: string[];
  // Optional identifier field references
  labelIdentifierFieldMetadataUniversalIdentifier: string | null;
  imageIdentifierFieldMetadataUniversalIdentifier: string | null;
  universalIdentifier: string;
  applicationId: string | null;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
};
