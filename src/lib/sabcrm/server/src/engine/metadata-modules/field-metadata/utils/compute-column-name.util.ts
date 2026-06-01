// PORT-NOTE: Depends on twenty-shared/utils (pascalCase) and the local
// is-composite-field-metadata-type util. Both are available in the target
// environment. FieldMetadataException is imported from the ported exception
// module. Logic ported verbatim.

import { type FieldMetadataType, type CompositeProperty } from "twenty-shared/types";
import { pascalCase } from "twenty-shared/utils";

import {
  FieldMetadataException,
  FieldMetadataExceptionCode,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/field-metadata.exception";
import { isCompositeFieldMetadataType } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/utils/is-composite-field-metadata-type.util";

type ComputeColumnNameOptions = { isForeignKey?: boolean };

export type FieldTypeAndNameMetadata = {
  name: string;
  type: FieldMetadataType;
};

// PORT-NOTE: Column name logic is Postgres-specific; preserved here because the
// same naming conventions apply to Mongo field keys for compatibility.
export function computeColumnName(
  fieldMetadataOrFieldName: FieldTypeAndNameMetadata | string,
  options?: ComputeColumnNameOptions,
): string {
  const generateName = (name: string) => {
    return options?.isForeignKey ? `${name}Id` : name;
  };

  if (typeof fieldMetadataOrFieldName === "string") {
    return generateName(fieldMetadataOrFieldName);
  }

  if (isCompositeFieldMetadataType(fieldMetadataOrFieldName.type)) {
    throw new FieldMetadataException(
      `Cannot compute composite column name for field: ${fieldMetadataOrFieldName.type}`,
      FieldMetadataExceptionCode.INVALID_FIELD_INPUT,
    );
  }

  return generateName(fieldMetadataOrFieldName.name);
}

export function computeCompositeColumnName(
  fieldMetadataOrFieldName: FieldTypeAndNameMetadata | string,
  compositeProperty: CompositeProperty,
): string {
  const generateName = (name: string) => {
    return `${name}${pascalCase(compositeProperty.name)}`;
  };

  if (typeof fieldMetadataOrFieldName === "string") {
    return generateName(fieldMetadataOrFieldName);
  }

  if (!isCompositeFieldMetadataType(fieldMetadataOrFieldName.type)) {
    throw new FieldMetadataException(
      `Cannot compute composite column name for non-composite field metadata type: ${fieldMetadataOrFieldName.type}`,
      FieldMetadataExceptionCode.INVALID_FIELD_INPUT,
    );
  }

  return generateName(fieldMetadataOrFieldName.name);
}
