// PORT-NOTE: Pure utility — ported as-is. Postgres column type string names are
// preserved because they are also used to derive Mongo field types elsewhere.
// Imports remapped to SabNode target paths.

import { FieldMetadataType } from '@/lib/sabcrm/shared/src/types/field-metadata-type.enum';
import {
  WorkspaceMigrationActionExecutionException,
  WorkspaceMigrationActionExecutionExceptionCode,
} from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/exceptions/workspace-migration-action-execution.exception';
import { isTextColumnType } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/is-text-column-type.util';

export const fieldMetadataTypeToColumnType = <Type extends FieldMetadataType>(
  fieldMetadataType: Type,
): string => {
  // Composite types are flattened by their composite definitions — not handled here.
  if (isTextColumnType(fieldMetadataType)) {
    return 'text';
  }
  switch (fieldMetadataType) {
    case FieldMetadataType.UUID:
      return 'uuid';
    case FieldMetadataType.NUMERIC:
      return 'numeric';
    case FieldMetadataType.NUMBER:
    case FieldMetadataType.POSITION:
      return 'float';
    case FieldMetadataType.BOOLEAN:
      return 'boolean';
    case FieldMetadataType.DATE_TIME:
      return 'timestamptz';
    case FieldMetadataType.DATE:
      return 'date';
    case FieldMetadataType.RATING:
    case FieldMetadataType.SELECT:
    case FieldMetadataType.MULTI_SELECT:
      return 'enum';
    case FieldMetadataType.FILES:
    case FieldMetadataType.RAW_JSON:
      return 'jsonb';
    case FieldMetadataType.TS_VECTOR:
      return 'tsvector';
    default:
      throw new WorkspaceMigrationActionExecutionException({
        message: `Cannot convert ${fieldMetadataType} to column type.`,
        code: WorkspaceMigrationActionExecutionExceptionCode.UNSUPPORTED_FIELD_METADATA_TYPE,
      });
  }
};
