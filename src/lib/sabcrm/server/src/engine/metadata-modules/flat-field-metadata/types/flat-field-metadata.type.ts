// PORT-NOTE: In Twenty, FlatFieldMetadata is derived via FlatEntityFrom<FieldMetadataEntity, 'fieldMetadata'>.
// Here we provide a plain structural type equivalent covering all fields used
// across the filter/group-by processors.  Relations are represented as id refs.

import { type FieldMetadataType } from 'src/lib/sabcrm/shared/src/types/FieldMetadataType';

export type FlatFieldMetadata<T extends FieldMetadataType = FieldMetadataType> =
  {
    id: string;
    objectMetadataId: string;
    type: T;
    name: string;
    label: string;
    defaultValue: unknown | null;
    description: string | null;
    icon: string | null;
    isCustom: boolean;
    isActive: boolean;
    isSystem: boolean;
    isUIReadOnly: boolean;
    isNullable: boolean | null;
    isUnique: boolean | null;
    isLabelSyncedWithName: boolean;
    options: unknown | null;
    settings: unknown | null;
    standardOverrides: { label?: string | null; description?: string | null; icon?: string | null } | null;
    // Relation-specific ids — undefined for non-relation types
    relationTargetFieldMetadataId?: string | null;
    relationTargetObjectMetadataId?: string | null;
    morphId?: string | null;
    universalIdentifier: string;
    applicationId: string | null;
    workspaceId: string;
    createdAt: Date;
    updatedAt: Date;
  };
