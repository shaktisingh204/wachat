// PORT-NOTE: Ported from twenty-server. Lingui msg tags replaced with plain strings.
// CustomException replaced with a plain Error subclass — no NestJS/Lingui deps.

export enum RecordCrudExceptionCode {
  INVALID_REQUEST = 'INVALID_REQUEST',
  WORKSPACE_ID_NOT_FOUND = 'WORKSPACE_ID_NOT_FOUND',
  OBJECT_NOT_FOUND = 'OBJECT_NOT_FOUND',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  RECORD_CREATION_FAILED = 'RECORD_CREATION_FAILED',
  RECORD_UPDATE_FAILED = 'RECORD_UPDATE_FAILED',
  RECORD_DELETION_FAILED = 'RECORD_DELETION_FAILED',
  RECORD_UPSERT_FAILED = 'RECORD_UPSERT_FAILED',
  QUERY_FAILED = 'QUERY_FAILED',
}

export class RecordCrudException extends Error {
  readonly code: RecordCrudExceptionCode;
  readonly userFriendlyMessage: string;

  constructor(
    message: string,
    code: RecordCrudExceptionCode,
    { userFriendlyMessage }: { userFriendlyMessage?: string } = {},
  ) {
    super(message);
    this.name = 'RecordCrudException';
    this.code = code;
    this.userFriendlyMessage = userFriendlyMessage ?? getDefaultUserMessage(code);
  }
}

function getDefaultUserMessage(code: RecordCrudExceptionCode): string {
  switch (code) {
    case RecordCrudExceptionCode.INVALID_REQUEST:
      return 'Invalid request.';
    case RecordCrudExceptionCode.WORKSPACE_ID_NOT_FOUND:
      return 'Workspace not found.';
    case RecordCrudExceptionCode.OBJECT_NOT_FOUND:
      return 'Object not found.';
    case RecordCrudExceptionCode.RECORD_NOT_FOUND:
      return 'Record not found.';
    case RecordCrudExceptionCode.RECORD_CREATION_FAILED:
      return 'Failed to create record.';
    case RecordCrudExceptionCode.RECORD_UPDATE_FAILED:
      return 'Failed to update record.';
    case RecordCrudExceptionCode.RECORD_DELETION_FAILED:
      return 'Failed to delete record.';
    case RecordCrudExceptionCode.RECORD_UPSERT_FAILED:
      return 'Failed to upsert record.';
    case RecordCrudExceptionCode.QUERY_FAILED:
      return 'Query failed.';
    default: {
      const _exhaustive: never = code;
      return 'Unknown error.';
    }
  }
}
