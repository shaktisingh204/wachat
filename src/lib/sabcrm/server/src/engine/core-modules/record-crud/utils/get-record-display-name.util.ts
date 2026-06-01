import { FieldMetadataType } from '@/lib/sabcrm/shared/src/types/FieldMetadataType';

import {
  type FlatFieldMetadata,
  type FlatObjectMetadata,
} from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/types/object-metadata-for-tool-schema.type';

// PORT-NOTE: FlatEntityMaps / findFlatEntityByIdInFlatEntityMaps ported inline
// as a simple Map-based lookup since the full flat-entity module is not yet ported.

export type FlatEntityMaps<T extends { id: string }> = {
  byId: Map<string, T>;
};

export const findFlatEntityByIdInFlatEntityMaps = <T extends { id: string }>({
  flatEntityMaps,
  flatEntityId,
}: {
  flatEntityMaps: FlatEntityMaps<T>;
  flatEntityId: string;
}): T | undefined => {
  return flatEntityMaps.byId.get(flatEntityId);
};

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

// Mirrors frontend's getLabelIdentifierFieldValue logic
export const getRecordDisplayName = (
  record: Record<string, unknown>,
  flatObjectMetadata: FlatObjectMetadata,
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>,
): string => {
  const { labelIdentifierFieldMetadataId } = flatObjectMetadata;

  if (!isDefined(labelIdentifierFieldMetadataId)) {
    return String(record.id ?? 'Unknown');
  }

  const labelIdentifierField = findFlatEntityByIdInFlatEntityMaps({
    flatEntityMaps: flatFieldMetadataMaps,
    flatEntityId: labelIdentifierFieldMetadataId,
  });

  if (!isDefined(labelIdentifierField)) {
    return String(record.id ?? 'Unknown');
  }

  const fieldValue = record[labelIdentifierField.name];

  // Handle FULL_NAME composite type (person, workspaceMember)
  if (labelIdentifierField.type === FieldMetadataType.FULL_NAME) {
    const nameValue = fieldValue as
      | { firstName?: string; lastName?: string }
      | undefined;
    const firstName = nameValue?.firstName ?? '';
    const lastName = nameValue?.lastName ?? '';

    return `${firstName} ${lastName}`.trim() || String(record.id) || 'Unknown';
  }

  return isDefined(fieldValue)
    ? String(fieldValue)
    : String(record.id ?? 'Unknown');
};
