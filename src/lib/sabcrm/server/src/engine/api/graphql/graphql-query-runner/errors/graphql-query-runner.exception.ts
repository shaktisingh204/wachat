// PORT-NOTE: MessageDescriptor from @lingui/core is kept as-is for i18n parity.
// CustomException base class is ported from src/utils/custom-exception (SabNode).

export enum GraphqlQueryRunnerExceptionCode {
  INVALID_QUERY_INPUT = 'INVALID_QUERY_INPUT',
  MAX_DEPTH_REACHED = 'MAX_DEPTH_REACHED',
  INVALID_CURSOR = 'INVALID_CURSOR',
  INVALID_DIRECTION = 'INVALID_DIRECTION',
  UNSUPPORTED_OPERATOR = 'UNSUPPORTED_OPERATOR',
  ARGS_CONFLICT = 'ARGS_CONFLICT',
  FIELD_NOT_FOUND = 'FIELD_NOT_FOUND',
  MISSING_SYSTEM_FIELD = 'MISSING_SYSTEM_FIELD',
  OBJECT_METADATA_NOT_FOUND = 'OBJECT_METADATA_NOT_FOUND',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  INVALID_ARGS_FIRST = 'INVALID_ARGS_FIRST',
  INVALID_ARGS_LAST = 'INVALID_ARGS_LAST',
  RELATION_SETTINGS_NOT_FOUND = 'RELATION_SETTINGS_NOT_FOUND',
  RELATION_TARGET_OBJECT_METADATA_NOT_FOUND = 'RELATION_TARGET_OBJECT_METADATA_NOT_FOUND',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  INVALID_POST_HOOK_PAYLOAD = 'INVALID_POST_HOOK_PAYLOAD',
  UPSERT_MULTIPLE_MATCHING_RECORDS_CONFLICT = 'UPSERT_MULTIPLE_MATCHING_RECORDS_CONFLICT',
  UPSERT_MAX_RECORDS_EXCEEDED = 'UPSERT_MAX_RECORDS_EXCEEDED',
}

export type MessageDescriptor = { id: string; message?: string } | string;

export class GraphqlQueryRunnerException extends Error {
  public readonly code: GraphqlQueryRunnerExceptionCode;
  public readonly userFriendlyMessage?: MessageDescriptor;

  constructor(
    message: string,
    code: GraphqlQueryRunnerExceptionCode,
    { userFriendlyMessage }: { userFriendlyMessage: MessageDescriptor },
  ) {
    super(message);
    this.name = 'GraphqlQueryRunnerException';
    this.code = code;
    this.userFriendlyMessage = userFriendlyMessage;
  }
}
