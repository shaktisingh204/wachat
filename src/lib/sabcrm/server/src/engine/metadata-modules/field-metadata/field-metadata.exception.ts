// PORT-NOTE: @lingui/core removed — user-friendly messages are plain strings.
// assertUnreachable kept via inline implementation; appendCommonExceptionCode
// and CustomException ported to plain TS.

export const COMMON_EXCEPTION_CODES = {
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
} as const;

function appendCommonExceptionCode<
  T extends Record<string, string>,
>(codes: T): T & typeof COMMON_EXCEPTION_CODES {
  return { ...codes, ...COMMON_EXCEPTION_CODES };
}

export const FieldMetadataExceptionCode = appendCommonExceptionCode({
  FIELD_METADATA_NOT_FOUND: "FIELD_METADATA_NOT_FOUND",
  INVALID_FIELD_INPUT: "INVALID_FIELD_INPUT",
  FIELD_MUTATION_NOT_ALLOWED: "FIELD_MUTATION_NOT_ALLOWED",
  FIELD_ALREADY_EXISTS: "FIELD_ALREADY_EXISTS",
  OBJECT_METADATA_NOT_FOUND: "OBJECT_METADATA_NOT_FOUND",
  APPLICATION_NOT_FOUND: "APPLICATION_NOT_FOUND",
  FIELD_METADATA_RELATION_NOT_ENABLED: "FIELD_METADATA_RELATION_NOT_ENABLED",
  FIELD_METADATA_RELATION_MALFORMED: "FIELD_METADATA_RELATION_MALFORMED",
  LABEL_IDENTIFIER_FIELD_METADATA_ID_NOT_FOUND:
    "LABEL_IDENTIFIER_FIELD_METADATA_ID_NOT_FOUND",
  UNCOVERED_FIELD_METADATA_TYPE_VALIDATION:
    "UNCOVERED_FIELD_METADATA_TYPE_VALIDATION",
  RESERVED_KEYWORD: "RESERVED_KEYWORD",
  NOT_AVAILABLE: "NOT_AVAILABLE",
  NAME_NOT_SYNCED_WITH_LABEL: "NAME_NOT_SYNCED_WITH_LABEL",
} as const);

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type FieldMetadataExceptionCode =
  (typeof FieldMetadataExceptionCode)[keyof typeof FieldMetadataExceptionCode];

const getUserFriendlyMessage = (
  code: keyof typeof FieldMetadataExceptionCode,
): string => {
  switch (code) {
    case FieldMetadataExceptionCode.FIELD_METADATA_NOT_FOUND:
      return "Field not found.";
    case FieldMetadataExceptionCode.INVALID_FIELD_INPUT:
      return "Invalid field input.";
    case FieldMetadataExceptionCode.FIELD_MUTATION_NOT_ALLOWED:
      return "This field cannot be modified.";
    case FieldMetadataExceptionCode.FIELD_ALREADY_EXISTS:
      return "A field with this name already exists.";
    case FieldMetadataExceptionCode.OBJECT_METADATA_NOT_FOUND:
      return "Object not found.";
    case FieldMetadataExceptionCode.APPLICATION_NOT_FOUND:
      return "Application not found.";
    case FieldMetadataExceptionCode.FIELD_METADATA_RELATION_NOT_ENABLED:
      return "Relation is not enabled for this field.";
    case FieldMetadataExceptionCode.FIELD_METADATA_RELATION_MALFORMED:
      return "Relation configuration is invalid.";
    case FieldMetadataExceptionCode.LABEL_IDENTIFIER_FIELD_METADATA_ID_NOT_FOUND:
      return "Label identifier field not found.";
    case FieldMetadataExceptionCode.UNCOVERED_FIELD_METADATA_TYPE_VALIDATION:
      return "Field type validation error.";
    case FieldMetadataExceptionCode.RESERVED_KEYWORD:
      return "This name is a reserved keyword.";
    case FieldMetadataExceptionCode.NOT_AVAILABLE:
      return "This field name is not available.";
    case FieldMetadataExceptionCode.NAME_NOT_SYNCED_WITH_LABEL:
      return "Field name is not synced with label.";
    case FieldMetadataExceptionCode.INTERNAL_SERVER_ERROR:
      return "An internal server error occurred.";
    default: {
      // exhaustiveness guard — TypeScript will warn if a case is missing
      const _exhaustive: never = code;
      return `Unknown error: ${String(_exhaustive)}`;
    }
  }
};

export class FieldMetadataException extends Error {
  readonly code: keyof typeof FieldMetadataExceptionCode;
  readonly userFriendlyMessage: string;

  constructor(
    message: string,
    code: keyof typeof FieldMetadataExceptionCode,
    options?: { userFriendlyMessage?: string },
  ) {
    super(message);
    this.name = "FieldMetadataException";
    this.code = code;
    this.userFriendlyMessage =
      options?.userFriendlyMessage ?? getUserFriendlyMessage(code);
  }
}
