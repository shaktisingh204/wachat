// PORT-NOTE: twenty-shared/types re-used directly; no NestJS / TypeORM
// dependencies in the original. Ported verbatim.

import { type FieldMetadataType, type IsExactly } from "twenty-shared/types";

export type AssignIfIsGivenFieldMetadataType<
  TTypeToAssign,
  TInputFieldMetadataType extends FieldMetadataType,
  TExpectedFieldMetadataType extends FieldMetadataType,
> =
  IsExactly<TInputFieldMetadataType, FieldMetadataType> extends true
    ? null | TTypeToAssign
    : TInputFieldMetadataType extends TExpectedFieldMetadataType
      ? TTypeToAssign
      : TInputFieldMetadataType extends TExpectedFieldMetadataType
        ? TTypeToAssign
        : never | null;
