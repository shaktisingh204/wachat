// PORT-NOTE: Ported from NestJS/Lingui exception. Replaced msg`` template literals
// with plain strings since Lingui is not part of SabNode. CustomError from twenty-shared
// is replaced with a plain Error subclass.

export const WorkspaceMigrationActionExecutionExceptionCode = {
  FIELD_METADATA_NOT_FOUND: 'FIELD_METADATA_NOT_FOUND',
  OBJECT_METADATA_NOT_FOUND: 'OBJECT_METADATA_NOT_FOUND',
  ENUM_OPERATION_FAILED: 'ENUM_OPERATION_FAILED',
  UNSUPPORTED_COMPOSITE_COLUMN_TYPE: 'UNSUPPORTED_COMPOSITE_COLUMN_TYPE',
  NOT_SUPPORTED: 'NOT_SUPPORTED',
  INVALID_ACTION_TYPE: 'INVALID_ACTION_TYPE',
  FLAT_ENTITY_NOT_FOUND: 'FLAT_ENTITY_NOT_FOUND',
  UNSUPPORTED_FIELD_METADATA_TYPE: 'UNSUPPORTED_FIELD_METADATA_TYPE',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

const getWorkspaceMigrationActionExecutionExceptionUserFriendlyMessage = (
  code: keyof typeof WorkspaceMigrationActionExecutionExceptionCode,
): string => {
  switch (code) {
    case WorkspaceMigrationActionExecutionExceptionCode.FIELD_METADATA_NOT_FOUND:
      return 'Field metadata not found.';
    case WorkspaceMigrationActionExecutionExceptionCode.OBJECT_METADATA_NOT_FOUND:
      return 'Object metadata not found.';
    case WorkspaceMigrationActionExecutionExceptionCode.ENUM_OPERATION_FAILED:
      return 'Enum operation failed.';
    case WorkspaceMigrationActionExecutionExceptionCode.UNSUPPORTED_COMPOSITE_COLUMN_TYPE:
      return 'Unsupported composite column type.';
    case WorkspaceMigrationActionExecutionExceptionCode.NOT_SUPPORTED:
      return 'This operation is not supported.';
    case WorkspaceMigrationActionExecutionExceptionCode.INVALID_ACTION_TYPE:
      return 'Invalid action type.';
    case WorkspaceMigrationActionExecutionExceptionCode.FLAT_ENTITY_NOT_FOUND:
      return 'Entity not found.';
    case WorkspaceMigrationActionExecutionExceptionCode.UNSUPPORTED_FIELD_METADATA_TYPE:
      return 'Unsupported field metadata type.';
    case WorkspaceMigrationActionExecutionExceptionCode.INTERNAL_SERVER_ERROR:
      return 'An unexpected error occurred.';
    default: {
      const _exhaustive: never = code;
      return 'An unexpected error occurred.';
    }
  }
};

export class WorkspaceMigrationActionExecutionException extends Error {
  code: keyof typeof WorkspaceMigrationActionExecutionExceptionCode;
  userFriendlyMessage: string;

  constructor({
    message,
    code,
    userFriendlyMessage,
  }: {
    message: string;
    code: keyof typeof WorkspaceMigrationActionExecutionExceptionCode;
    userFriendlyMessage?: string;
  }) {
    super(message);
    this.name = 'WorkspaceMigrationActionExecutionException';
    this.code = code;
    this.userFriendlyMessage =
      userFriendlyMessage ??
      getWorkspaceMigrationActionExecutionExceptionUserFriendlyMessage(code);
  }
}
