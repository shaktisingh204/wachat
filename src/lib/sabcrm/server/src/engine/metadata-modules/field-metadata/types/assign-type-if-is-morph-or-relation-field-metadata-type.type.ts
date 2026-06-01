// PORT-NOTE: No NestJS/TypeORM dependencies. Ported verbatim, using target
// paths for internal imports.

import { type FieldMetadataType } from "twenty-shared/types";

import { type AssignIfIsGivenFieldMetadataType } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/types/assign-if-is-given-field-metadata-type.type";
import { type MorphOrRelationFieldMetadataType } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/types/morph-or-relation-field-metadata-type.type";

export type AssignTypeIfIsMorphOrRelationFieldMetadataType<
  TTypeToAssign,
  TFieldMetadataType extends FieldMetadataType,
> = AssignIfIsGivenFieldMetadataType<
  TTypeToAssign,
  TFieldMetadataType,
  MorphOrRelationFieldMetadataType
>;
