// PORT-NOTE: Ported from twenty-server.
// @lingui/core msg-tagged-template literals removed — messages are stored as plain strings.
// assertUnreachable (from twenty-shared) replaced with an inline exhaustive check.
// CustomException base class inlined as a plain Error subclass since NestJS/Lingui are absent.

export enum ConfigVariableExceptionCode {
  DATABASE_CONFIG_DISABLED = 'DATABASE_CONFIG_DISABLED',
  ENVIRONMENT_ONLY_VARIABLE = 'ENVIRONMENT_ONLY_VARIABLE',
  VARIABLE_NOT_FOUND = 'VARIABLE_NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNSUPPORTED_CONFIG_TYPE = 'UNSUPPORTED_CONFIG_TYPE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

const getUserFriendlyMessage = (code: ConfigVariableExceptionCode): string => {
  switch (code) {
    case ConfigVariableExceptionCode.DATABASE_CONFIG_DISABLED:
      return 'Database configuration is disabled.';
    case ConfigVariableExceptionCode.ENVIRONMENT_ONLY_VARIABLE:
      return 'This variable can only be set via environment.';
    case ConfigVariableExceptionCode.VARIABLE_NOT_FOUND:
      return 'Configuration variable not found.';
    case ConfigVariableExceptionCode.VALIDATION_FAILED:
      return 'Configuration validation failed.';
    case ConfigVariableExceptionCode.UNSUPPORTED_CONFIG_TYPE:
      return 'Unsupported configuration type.';
    case ConfigVariableExceptionCode.INTERNAL_ERROR:
      return 'An unexpected configuration error occurred.';
    default: {
      const _exhaustive: never = code;

      return `Unknown config exception: ${_exhaustive}`;
    }
  }
};

export class ConfigVariableException extends Error {
  readonly code: ConfigVariableExceptionCode;
  readonly userFriendlyMessage: string;

  constructor(
    message: string,
    code: ConfigVariableExceptionCode,
    {
      userFriendlyMessage,
    }: { userFriendlyMessage?: string } = {},
  ) {
    super(message);
    this.name = 'ConfigVariableException';
    this.code = code;
    this.userFriendlyMessage = userFriendlyMessage ?? getUserFriendlyMessage(code);
  }
}
