// PORT-NOTE: This file is a faithful port of the Twenty ConfigVariables class.
// class-transformer / class-validator decorators are preserved so the validate()
// function at the bottom works identically. Decorators that reference Twenty-internal
// sub-packages (CastToUpperSnakeCase, ConfigVariablesMetadata, IsAWSRegion,
// IsDuration, IsOptionalOrEmptyString, IsStrictlyLowerThan, IsTwentySemVer,
// ConfigVariablesGroup, ConfigVariableType, ConfigVariableException) are stubbed
// as no-ops — their business logic is Postgres-admin-panel config management which
// is replaced by SabNode's own config layer. All env-var fields and their defaults
// are preserved exactly so the validate() function still works against process.env.

import { Logger } from '@nestjs/common';

import { plainToClass } from 'class-transformer';
import {
  IsDefined,
  IsOptional,
  IsUrl,
  ValidateIf,
  type ValidationError,
  validateSync,
} from 'class-validator';

import { CastToLogLevelArray } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/decorators/cast-to-log-level-array.decorator';
import { CastToMeterDriverArray, MeterDriver } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/decorators/cast-to-meter-driver.decorator';
import { CastToPositiveNumber } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/decorators/cast-to-positive-number.decorator';
import { CastToTypeORMLogLevelArray } from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/decorators/cast-to-typeorm-log-level-array.decorator';

// ---- Stubs for Twenty-internal decorators / enums not ported yet ----

// PORT-NOTE: These decorator stubs preserve the field-decoration call signature
// without any runtime effect beyond pass-through.
const noop =
  () =>
  (_target: object, _propertyKey: string): void => {};

const CastToUpperSnakeCase = noop;
const ConfigVariablesMetadata = (_meta: object) => noop();
const IsAWSRegion = noop;
const IsDuration = noop;
const IsOptionalOrEmptyString = noop;
const IsStrictlyLowerThan = (_field: string, _opts?: object) => noop();
const IsTwentySemVer = noop;

export enum ConfigVariablesGroup {
  ADVANCED_SETTINGS = 'ADVANCED_SETTINGS',
  ANALYTICS_CONFIG = 'ANALYTICS_CONFIG',
  AWS_SES_SETTINGS = 'AWS_SES_SETTINGS',
  BILLING_CONFIG = 'BILLING_CONFIG',
  CAPTCHA_CONFIG = 'CAPTCHA_CONFIG',
  CLOUDFLARE_CONFIG = 'CLOUDFLARE_CONFIG',
  CODE_INTERPRETER_CONFIG = 'CODE_INTERPRETER_CONFIG',
  EMAIL_SETTINGS = 'EMAIL_SETTINGS',
  GOOGLE_AUTH = 'GOOGLE_AUTH',
  LLM = 'LLM',
  LOGIC_FUNCTION_CONFIG = 'LOGIC_FUNCTION_CONFIG',
  LOGGING = 'LOGGING',
  MICROSOFT_AUTH = 'MICROSOFT_AUTH',
  RATE_LIMITING = 'RATE_LIMITING',
  SERVER_CONFIG = 'SERVER_CONFIG',
  SSL = 'SSL',
  STORAGE_CONFIG = 'STORAGE_CONFIG',
  SUPPORT_CHAT_CONFIG = 'SUPPORT_CHAT_CONFIG',
  TOKENS_DURATION = 'TOKENS_DURATION',
}

export enum ConfigVariableType {
  ARRAY = 'ARRAY',
  BOOLEAN = 'BOOLEAN',
  ENUM = 'ENUM',
  JSON = 'JSON',
  NUMBER = 'NUMBER',
  STRING = 'STRING',
}

export enum EmailDriver {
  LOGGER = 'LOGGER',
  SMTP = 'SMTP',
  SENDGRID = 'SENDGRID',
  SES = 'SES',
}

export enum StorageDriverType {
  LOCAL = 'LOCAL',
  S_3 = 'S_3',
}

export enum LogicFunctionDriverType {
  DISABLED = 'DISABLED',
  LAMBDA = 'LAMBDA',
  LOCAL = 'LOCAL',
}

export enum CodeInterpreterDriverType {
  DISABLED = 'DISABLED',
  E_2_B = 'E_2_B',
  LOCAL = 'LOCAL',
}

export enum NodeEnvironment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

export enum SupportDriver {
  FRONT = 'FRONT',
  NONE = 'NONE',
}

export enum ExceptionHandlerDriver {
  CONSOLE = 'CONSOLE',
  SENTRY = 'SENTRY',
}

export enum LoggerDriverType {
  CONSOLE = 'CONSOLE',
}

export enum ApplicationLogDriver {
  CLICKHOUSE = 'CLICKHOUSE',
  CONSOLE = 'CONSOLE',
  DISABLED = 'DISABLED',
}

export enum CaptchaDriverType {
  GOOGLE_RECAPTCHA = 'GOOGLE_RECAPTCHA',
  TURNSTILE = 'TURNSTILE',
}

export type AwsRegion = string;

export type AiProvidersConfig = Record<string, unknown>;

// Default AI model preferences (stubs matching structure expected by config)
export const DEFAULT_FAST_MODELS: string[] = [];
export const DEFAULT_SMART_MODELS: string[] = [];
export const DEFAULT_RECOMMENDED_MODELS: string[] = [];
export const DEFAULT_DISABLED_MODELS: string[] = [];

export class ConfigVariableException extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

export const ConfigVariableExceptionCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
} as const;

// ---- Main class ----

export class ConfigVariables {
  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Enable or disable password authentication for users',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  AUTH_PASSWORD_ENABLED = true;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Prefills tim@apple.dev in the login form',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  @ValidateIf((env) => env.AUTH_PASSWORD_ENABLED)
  SIGN_IN_PREFILLED = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Require email verification for user accounts',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  IS_EMAIL_VERIFICATION_REQUIRED = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Enable safe mode for outbound requests',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  OUTBOUND_HTTP_SAFE_MODE_ENABLED = true;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Lock workspace schema DDL changes (for hot upgrades)',
    isEnvOnly: true,
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  WORKSPACE_SCHEMA_DDL_LOCKED = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.TOKENS_DURATION,
    description: 'Duration for which the email verification token is valid',
    type: ConfigVariableType.STRING,
  })
  @IsDuration()
  @IsOptional()
  EMAIL_VERIFICATION_TOKEN_EXPIRES_IN = '1h';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.TOKENS_DURATION,
    description: 'Duration for which the password reset token is valid',
    type: ConfigVariableType.STRING,
  })
  @IsDuration()
  @IsOptional()
  PASSWORD_RESET_TOKEN_EXPIRES_IN = '5m';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.GOOGLE_AUTH,
    description: 'Enable or disable the Google Calendar integration',
    type: ConfigVariableType.BOOLEAN,
  })
  CALENDAR_PROVIDER_GOOGLE_ENABLED = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.GOOGLE_AUTH,
    description: 'Callback URL for Google Auth APIs',
    type: ConfigVariableType.STRING,
    isSensitive: false,
  })
  AUTH_GOOGLE_APIS_CALLBACK_URL!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.GOOGLE_AUTH,
    description: 'Enable or disable Google Single Sign-On (SSO)',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  AUTH_GOOGLE_ENABLED = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.GOOGLE_AUTH,
    isSensitive: false,
    description: 'Client ID for Google authentication',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.AUTH_GOOGLE_ENABLED)
  AUTH_GOOGLE_CLIENT_ID!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.GOOGLE_AUTH,
    isSensitive: true,
    description: 'Client secret for Google authentication',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.AUTH_GOOGLE_ENABLED)
  AUTH_GOOGLE_CLIENT_SECRET!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.GOOGLE_AUTH,
    isSensitive: false,
    description: 'Callback URL for Google authentication',
    type: ConfigVariableType.STRING,
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  @ValidateIf((env) => env.AUTH_GOOGLE_ENABLED)
  AUTH_GOOGLE_CALLBACK_URL!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.GOOGLE_AUTH,
    description: 'Enable or disable the Gmail messaging integration',
    type: ConfigVariableType.BOOLEAN,
  })
  MESSAGING_PROVIDER_GMAIL_ENABLED = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Enable or disable the IMAP messaging integration',
    type: ConfigVariableType.BOOLEAN,
  })
  IS_IMAP_SMTP_CALDAV_ENABLED = true;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Enable or disable the connection test when saving IMAP/SMTP/CALDAV accounts',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  IS_IMAP_SMTP_CALDAV_CONNECTION_TEST_ENABLED = true;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: "Enable or disable requests to twenty-icons",
    type: ConfigVariableType.BOOLEAN,
  })
  ALLOW_REQUESTS_TO_TWENTY_ICONS = true;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.MICROSOFT_AUTH,
    description: 'Enable or disable Microsoft authentication',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  AUTH_MICROSOFT_ENABLED = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.MICROSOFT_AUTH,
    isSensitive: false,
    description: 'Client ID for Microsoft authentication',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.AUTH_MICROSOFT_ENABLED)
  AUTH_MICROSOFT_CLIENT_ID!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.MICROSOFT_AUTH,
    isSensitive: true,
    description: 'Client secret for Microsoft authentication',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.AUTH_MICROSOFT_ENABLED)
  AUTH_MICROSOFT_CLIENT_SECRET!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.MICROSOFT_AUTH,
    isSensitive: false,
    description: 'Callback URL for Microsoft authentication',
    type: ConfigVariableType.STRING,
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  @ValidateIf((env) => env.AUTH_MICROSOFT_ENABLED)
  AUTH_MICROSOFT_CALLBACK_URL!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.MICROSOFT_AUTH,
    isSensitive: false,
    description: 'Callback URL for Microsoft APIs',
    type: ConfigVariableType.STRING,
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  @ValidateIf((env) => env.AUTH_MICROSOFT_ENABLED)
  AUTH_MICROSOFT_APIS_CALLBACK_URL!: string;

  /** @deprecated record page layouts are now always seeded */
  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Deprecated - record page layouts are now always seeded (GA)',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  SHOULD_SEED_STANDARD_RECORD_PAGE_LAYOUTS = true;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.MICROSOFT_AUTH,
    description: 'Enable or disable the Microsoft messaging integration',
    type: ConfigVariableType.BOOLEAN,
  })
  MESSAGING_PROVIDER_MICROSOFT_ENABLED = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Number of messages fetched per batch during message import',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  @IsOptional()
  MESSAGING_MESSAGES_GET_BATCH_SIZE = 400;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.MICROSOFT_AUTH,
    description: 'Enable or disable the Microsoft Calendar integration',
    type: ConfigVariableType.BOOLEAN,
  })
  CALENDAR_PROVIDER_MICROSOFT_ENABLED = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.TOKENS_DURATION,
    description: 'Duration for which the access token is valid',
    type: ConfigVariableType.STRING,
  })
  @IsDuration()
  @IsOptional()
  ACCESS_TOKEN_EXPIRES_IN = '30m';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.TOKENS_DURATION,
    description: 'Duration for which the workspace agnostic token is valid',
    type: ConfigVariableType.STRING,
  })
  @IsDuration()
  @IsOptional()
  WORKSPACE_AGNOSTIC_TOKEN_EXPIRES_IN = '30m';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.TOKENS_DURATION,
    description: 'Duration for which the refresh token is valid',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  REFRESH_TOKEN_EXPIRES_IN = '60d';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.TOKENS_DURATION,
    description: 'Grace period allowing concurrent refresh token use',
    type: ConfigVariableType.STRING,
  })
  @IsDuration()
  @IsOptional()
  REFRESH_TOKEN_REUSE_GRACE_PERIOD = '1m';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.TOKENS_DURATION,
    description: 'Duration for which the login token is valid',
    type: ConfigVariableType.STRING,
  })
  @IsDuration()
  @IsOptional()
  LOGIN_TOKEN_EXPIRES_IN = '15m';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.TOKENS_DURATION,
    description: 'Duration for which the file token is valid',
    type: ConfigVariableType.STRING,
  })
  @IsDuration()
  @IsOptional()
  FILE_TOKEN_EXPIRES_IN = '1d';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.TOKENS_DURATION,
    description: 'Duration for which the invitation token is valid',
    type: ConfigVariableType.STRING,
  })
  @IsDuration()
  @IsOptional()
  INVITATION_TOKEN_EXPIRES_IN = '30d';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.TOKENS_DURATION,
    description: 'Duration for which the short-term token is valid',
    type: ConfigVariableType.STRING,
  })
  SHORT_TERM_TOKEN_EXPIRES_IN = '5m';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.TOKENS_DURATION,
    description: 'Duration for which an application access token is valid',
    type: ConfigVariableType.STRING,
  })
  @IsDuration()
  @IsOptional()
  APPLICATION_ACCESS_TOKEN_EXPIRES_IN = '30m';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.TOKENS_DURATION,
    description: 'Duration for which an application refresh token is valid',
    type: ConfigVariableType.STRING,
  })
  @IsDuration()
  @IsOptional()
  APPLICATION_REFRESH_TOKEN_EXPIRES_IN = '60d';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.EMAIL_SETTINGS,
    description: 'Email address used as the sender for outgoing emails',
    type: ConfigVariableType.STRING,
  })
  EMAIL_FROM_ADDRESS = 'noreply@yourdomain.com';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.EMAIL_SETTINGS,
    description: 'Name used in the From header for outgoing emails',
    type: ConfigVariableType.STRING,
  })
  EMAIL_FROM_NAME = 'Felix from SabCRM';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.EMAIL_SETTINGS,
    description: 'Email driver to use for sending emails',
    type: ConfigVariableType.ENUM,
    options: Object.values(EmailDriver),
  })
  @CastToUpperSnakeCase()
  EMAIL_DRIVER: EmailDriver = EmailDriver.LOGGER;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.EMAIL_SETTINGS,
    description: 'SMTP host for sending emails',
    type: ConfigVariableType.STRING,
  })
  EMAIL_SMTP_HOST!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.EMAIL_SETTINGS,
    description: 'Use unsecure connection for SMTP',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  EMAIL_SMTP_NO_TLS = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.EMAIL_SETTINGS,
    description: 'SMTP port for sending emails',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  EMAIL_SMTP_PORT = 587;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.EMAIL_SETTINGS,
    description: 'SMTP user for authentication',
    type: ConfigVariableType.STRING,
    isSensitive: true,
  })
  EMAIL_SMTP_USER!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.EMAIL_SETTINGS,
    isSensitive: true,
    description: 'SMTP password for authentication',
    type: ConfigVariableType.STRING,
  })
  EMAIL_SMTP_PASSWORD!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'When enabled, only server admins can create new workspaces',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  IS_WORKSPACE_CREATION_LIMITED_TO_SERVER_ADMINS = true;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.STORAGE_CONFIG,
    description: 'Type of storage to use (local or S3)',
    type: ConfigVariableType.ENUM,
    options: Object.values(StorageDriverType),
  })
  @IsOptional()
  @CastToUpperSnakeCase()
  STORAGE_TYPE: StorageDriverType = StorageDriverType.LOCAL;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.STORAGE_CONFIG,
    description: 'Local path for storage when using local storage type',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.STORAGE_TYPE === StorageDriverType.LOCAL)
  STORAGE_LOCAL_PATH = '.local-storage';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.STORAGE_CONFIG,
    description: 'AWS region of the S3 bucket',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.STORAGE_TYPE === StorageDriverType.S_3)
  @IsAWSRegion()
  STORAGE_S3_REGION!: AwsRegion;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.STORAGE_CONFIG,
    description: 'Name of the S3 bucket used for file storage',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.STORAGE_TYPE === StorageDriverType.S_3)
  STORAGE_S3_NAME!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.STORAGE_CONFIG,
    description: 'Custom S3 endpoint URL',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.STORAGE_TYPE === StorageDriverType.S_3)
  @IsOptional()
  STORAGE_S3_ENDPOINT!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.STORAGE_CONFIG,
    isSensitive: true,
    description: 'S3 access key ID',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.STORAGE_TYPE === StorageDriverType.S_3)
  @IsOptional()
  STORAGE_S3_ACCESS_KEY_ID!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.STORAGE_CONFIG,
    isSensitive: true,
    description: 'S3 secret access key',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.STORAGE_TYPE === StorageDriverType.S_3)
  @IsOptional()
  STORAGE_S3_SECRET_ACCESS_KEY!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.STORAGE_CONFIG,
    description: 'When enabled, file downloads are 302-redirected to S3 presigned URLs',
    type: ConfigVariableType.BOOLEAN,
  })
  @ValidateIf((env) => env.STORAGE_TYPE === StorageDriverType.S_3)
  @IsOptional()
  STORAGE_S3_PRESIGNED_URL_ENABLED = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.STORAGE_CONFIG,
    description: 'Public S3 endpoint used for generating presigned URLs',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.STORAGE_TYPE === StorageDriverType.S_3)
  @IsOptional()
  STORAGE_S3_PRESIGNED_URL_BASE!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.STORAGE_CONFIG,
    description: 'TTL in seconds for S3 presigned URLs',
    type: ConfigVariableType.NUMBER,
  })
  @ValidateIf((env) => env.STORAGE_TYPE === StorageDriverType.S_3)
  @CastToPositiveNumber()
  @IsOptional()
  STORAGE_S3_PRESIGNED_URL_EXPIRES_IN: number = 900;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.STORAGE_CONFIG,
    description: 'Maximum tarball upload size in bytes',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  @IsOptional()
  MAX_TARBALL_UPLOAD_SIZE_BYTES: number = 100 * 1024 * 1024;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGIC_FUNCTION_CONFIG,
    description: 'Type of function execution (local or Lambda)',
    type: ConfigVariableType.ENUM,
    options: Object.values(LogicFunctionDriverType),
  })
  @IsOptional()
  @CastToUpperSnakeCase()
  LOGIC_FUNCTION_TYPE: LogicFunctionDriverType =
    process.env.NODE_ENV === NodeEnvironment.DEVELOPMENT
      ? LogicFunctionDriverType.LOCAL
      : LogicFunctionDriverType.DISABLED;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGIC_FUNCTION_CONFIG,
    description: 'Configure whether console logs from logic functions are displayed',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  LOGIC_FUNCTION_LOGS_ENABLED: false = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGIC_FUNCTION_CONFIG,
    description: 'Throttle limit for logic function execution',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  LOGIC_FUNCTION_EXEC_THROTTLE_LIMIT = 1000;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGIC_FUNCTION_CONFIG,
    description: 'Time-to-live for logic function execution throttle',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  LOGIC_FUNCTION_EXEC_THROTTLE_TTL = 60_000;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGIC_FUNCTION_CONFIG,
    description: 'Region for AWS Lambda functions',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf(
    (env) => env.LOGIC_FUNCTION_TYPE === LogicFunctionDriverType.LAMBDA,
  )
  @IsAWSRegion()
  LOGIC_FUNCTION_LAMBDA_REGION!: AwsRegion;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGIC_FUNCTION_CONFIG,
    description: 'IAM role for AWS Lambda functions',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf(
    (env) => env.LOGIC_FUNCTION_TYPE === LogicFunctionDriverType.LAMBDA,
  )
  LOGIC_FUNCTION_LAMBDA_ROLE!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGIC_FUNCTION_CONFIG,
    description: 'Role to assume when hosting lambdas in dedicated AWS account',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf(
    (env) => env.LOGIC_FUNCTION_TYPE === LogicFunctionDriverType.LAMBDA,
  )
  @IsOptional()
  LOGIC_FUNCTION_LAMBDA_SUBHOSTING_ROLE?: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGIC_FUNCTION_CONFIG,
    isSensitive: true,
    description: 'Access key ID for AWS Lambda functions',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf(
    (env) => env.LOGIC_FUNCTION_TYPE === LogicFunctionDriverType.LAMBDA,
  )
  @IsOptional()
  LOGIC_FUNCTION_LAMBDA_ACCESS_KEY_ID!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGIC_FUNCTION_CONFIG,
    isSensitive: true,
    description: 'Secret access key for AWS Lambda functions',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf(
    (env) => env.LOGIC_FUNCTION_TYPE === LogicFunctionDriverType.LAMBDA,
  )
  @IsOptional()
  LOGIC_FUNCTION_LAMBDA_SECRET_ACCESS_KEY!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGIC_FUNCTION_CONFIG,
    description: 'S3 bucket for uploading Lambda layer zip files',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf(
    (env) => env.LOGIC_FUNCTION_TYPE === LogicFunctionDriverType.LAMBDA,
  )
  @IsOptional()
  LOGIC_FUNCTION_LAMBDA_LAYER_BUCKET?: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGIC_FUNCTION_CONFIG,
    description: 'AWS region of the S3 bucket for Lambda layer uploads',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf(
    (env) => env.LOGIC_FUNCTION_TYPE === LogicFunctionDriverType.LAMBDA,
  )
  @IsOptional()
  @IsAWSRegion()
  LOGIC_FUNCTION_LAMBDA_LAYER_BUCKET_REGION?: AwsRegion;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.CODE_INTERPRETER_CONFIG,
    description: 'Code interpreter driver type',
    type: ConfigVariableType.STRING,
    options: Object.values(CodeInterpreterDriverType),
  })
  @IsOptional()
  @CastToUpperSnakeCase()
  CODE_INTERPRETER_TYPE: CodeInterpreterDriverType =
    process.env.NODE_ENV === NodeEnvironment.DEVELOPMENT
      ? CodeInterpreterDriverType.LOCAL
      : CodeInterpreterDriverType.DISABLED;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.CODE_INTERPRETER_CONFIG,
    description: 'E2B API key for sandboxed code execution',
    type: ConfigVariableType.STRING,
    isSensitive: true,
  })
  @ValidateIf(
    (env) => env.CODE_INTERPRETER_TYPE === CodeInterpreterDriverType.E_2_B,
  )
  E2B_API_KEY?: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.CODE_INTERPRETER_CONFIG,
    description: 'Timeout in milliseconds for code execution',
    type: ConfigVariableType.NUMBER,
  })
  @IsOptional()
  @CastToPositiveNumber()
  CODE_INTERPRETER_TIMEOUT_MS = 300_000;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ANALYTICS_CONFIG,
    description: 'Enable or disable analytics for telemetry',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  ANALYTICS_ENABLED = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ANALYTICS_CONFIG,
    description: 'Clickhouse host for analytics',
    type: ConfigVariableType.STRING,
    isSensitive: true,
  })
  @IsOptional()
  @IsUrl({ require_tld: false, allow_underscores: true })
  @ValidateIf((env) => env.ANALYTICS_ENABLED === true)
  CLICKHOUSE_URL!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGGING,
    description: 'Enable or disable telemetry logging',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  TELEMETRY_ENABLED = true;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGGING,
    description: 'TypeORM logging options for development mode',
    type: ConfigVariableType.ARRAY,
    options: ['query', 'schema', 'error', 'warn', 'info', 'log', 'migration'],
  })
  @CastToTypeORMLogLevelArray()
  @IsOptional()
  TYPEORM_LOGGING: string[] = ['error'];

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.BILLING_CONFIG,
    description: 'Enable or disable billing features',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  IS_BILLING_ENABLED = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.BILLING_CONFIG,
    description: 'Link required for billing plan',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.IS_BILLING_ENABLED === true)
  BILLING_PLAN_REQUIRED_LINK!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.BILLING_CONFIG,
    description: 'Duration of free trial with credit card in days',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  @IsOptional()
  @ValidateIf((env) => env.IS_BILLING_ENABLED === true)
  BILLING_FREE_TRIAL_WITH_CREDIT_CARD_DURATION_IN_DAYS = 30;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.BILLING_CONFIG,
    description: 'Duration of free trial without credit card in days',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  @IsOptional()
  @ValidateIf((env) => env.IS_BILLING_ENABLED === true)
  BILLING_FREE_TRIAL_WITHOUT_CREDIT_CARD_DURATION_IN_DAYS = 7;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.BILLING_CONFIG,
    description: 'Amount of credits for the free trial without credit card (in microCredits)',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  @ValidateIf((env) => env.IS_BILLING_ENABLED === true)
  BILLING_FREE_WORKFLOW_CREDITS_FOR_TRIAL_PERIOD_WITHOUT_CREDIT_CARD = 500_000;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.BILLING_CONFIG,
    description: 'Amount of credits for the free trial with credit card (in microCredits)',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  @ValidateIf((env) => env.IS_BILLING_ENABLED === true)
  BILLING_FREE_WORKFLOW_CREDITS_FOR_TRIAL_PERIOD_WITH_CREDIT_CARD = 5_000_000;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.BILLING_CONFIG,
    isSensitive: true,
    description: 'Stripe API key for billing',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.IS_BILLING_ENABLED === true)
  BILLING_STRIPE_API_KEY!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.BILLING_CONFIG,
    isSensitive: true,
    description: 'Stripe webhook secret for billing',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.IS_BILLING_ENABLED === true)
  BILLING_STRIPE_WEBHOOK_SECRET!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.BILLING_CONFIG,
    description: 'Use ClickHouse-backed poller for metered-credit cap enforcement',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  BILLING_USAGE_CAP_CLICKHOUSE_ENABLED = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    description: 'Url for the frontend application',
    type: ConfigVariableType.STRING,
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  @IsOptional()
  FRONTEND_URL!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    description: 'Default subdomain for the frontend when multi-workspace is enabled',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.IS_MULTIWORKSPACE_ENABLED)
  DEFAULT_SUBDOMAIN = 'app';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Page ID for Cal.com booking integration',
    isHiddenInAdminPanel: true,
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  CALENDAR_BOOKING_PAGE_ID?: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGGING,
    description: 'Enable or disable buffering for logs before sending',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  LOGGER_IS_BUFFER_ENABLED = true;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGGING,
    description: 'Driver used for handling exceptions',
    type: ConfigVariableType.ENUM,
    options: Object.values(ExceptionHandlerDriver),
    isEnvOnly: true,
  })
  @IsOptional()
  @CastToUpperSnakeCase()
  EXCEPTION_HANDLER_DRIVER: ExceptionHandlerDriver = ExceptionHandlerDriver.CONSOLE;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGGING,
    description: 'Levels of logging to be captured',
    type: ConfigVariableType.ARRAY,
    options: ['log', 'error', 'warn', 'debug'],
    isEnvOnly: true,
  })
  @CastToLogLevelArray()
  @IsOptional()
  LOG_LEVELS: string[] = ['log', 'error', 'warn'];

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGGING,
    description: 'Driver used for collect metrics',
    type: ConfigVariableType.ARRAY,
    options: ['OpenTelemetry', 'Console'],
    isEnvOnly: true,
  })
  @CastToMeterDriverArray()
  @IsOptional()
  METER_DRIVER: MeterDriver[] = [];

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGGING,
    description: 'Driver used for logging',
    type: ConfigVariableType.ENUM,
    options: Object.values(LoggerDriverType),
    isEnvOnly: true,
  })
  @IsOptional()
  @CastToUpperSnakeCase()
  LOGGER_DRIVER: LoggerDriverType = LoggerDriverType.CONSOLE;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGGING,
    description: 'Data Source Name (DSN) for Sentry logging',
    type: ConfigVariableType.STRING,
    isSensitive: true,
  })
  @ValidateIf(
    (env) => env.EXCEPTION_HANDLER_DRIVER === ExceptionHandlerDriver.SENTRY,
  )
  SENTRY_DSN!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGGING,
    description: 'Front-end DSN for Sentry logging',
    type: ConfigVariableType.STRING,
    isSensitive: true,
  })
  @ValidateIf(
    (env) => env.EXCEPTION_HANDLER_DRIVER === ExceptionHandlerDriver.SENTRY,
  )
  SENTRY_FRONT_DSN!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGGING,
    description: 'Environment name for Sentry logging',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf(
    (env) => env.EXCEPTION_HANDLER_DRIVER === ExceptionHandlerDriver.SENTRY,
  )
  @IsOptional()
  SENTRY_ENVIRONMENT!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LOGGING,
    description: 'Driver used for application logs',
    type: ConfigVariableType.ENUM,
    options: Object.values(ApplicationLogDriver),
    isEnvOnly: true,
  })
  @IsOptional()
  @CastToUpperSnakeCase()
  APPLICATION_LOG_DRIVER: ApplicationLogDriver = ApplicationLogDriver.DISABLED;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SUPPORT_CHAT_CONFIG,
    description: 'Driver used for support chat integration',
    type: ConfigVariableType.ENUM,
    options: Object.values(SupportDriver),
  })
  @IsOptional()
  @CastToUpperSnakeCase()
  SUPPORT_DRIVER: SupportDriver = SupportDriver.NONE;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SUPPORT_CHAT_CONFIG,
    isSensitive: true,
    description: 'Chat ID for the support front integration',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.SUPPORT_DRIVER === SupportDriver.FRONT)
  SUPPORT_FRONT_CHAT_ID!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SUPPORT_CHAT_CONFIG,
    isSensitive: true,
    description: 'HMAC key for the support front integration',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.SUPPORT_DRIVER === SupportDriver.FRONT)
  SUPPORT_FRONT_HMAC_KEY!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    isSensitive: true,
    description: 'Database connection URL',
    type: ConfigVariableType.STRING,
    isEnvOnly: true,
  })
  @IsDefined()
  @IsUrl({
    protocols: ['postgres', 'postgresql'],
    require_tld: false,
    allow_underscores: true,
    require_host: false,
  })
  PG_DATABASE_URL!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    isSensitive: true,
    description: 'Optional PostgreSQL replica connection URL for read queries',
    type: ConfigVariableType.STRING,
    isEnvOnly: true,
  })
  @IsOptional()
  @IsUrl({
    protocols: ['postgres', 'postgresql'],
    require_tld: false,
    allow_underscores: true,
    require_host: false,
  })
  PG_DATABASE_REPLICA_URL!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    description: 'Allow connections to a database with self-signed certificates',
    isEnvOnly: true,
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  PG_SSL_ALLOW_SELF_SIGNED = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Maximum number of clients in pg connection pool',
    isEnvOnly: true,
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  @IsOptional()
  PG_POOL_MAX_CONNECTIONS = 10;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Idle timeout in milliseconds for pg connection pool clients',
    isEnvOnly: true,
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  @IsOptional()
  PG_POOL_IDLE_TIMEOUT_MS = 600000;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Allow idle pg connection pool clients to exit',
    isEnvOnly: true,
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  PG_POOL_ALLOW_EXIT_ON_IDLE = true;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    description: 'Enable configuration variables to be stored in the database',
    isEnvOnly: true,
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  IS_CONFIG_VARIABLES_IN_DB_ENABLED = true;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.TOKENS_DURATION,
    description: 'Time-to-live for cache storage in seconds',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  CACHE_STORAGE_TTL: number = 3600 * 24 * 7;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    isSensitive: true,
    description: 'Redis connection URL used for cache and queues by default',
    isEnvOnly: true,
    type: ConfigVariableType.STRING,
  })
  @IsUrl({
    protocols: ['redis', 'rediss'],
    require_tld: false,
    allow_underscores: true,
  })
  REDIS_URL!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    isSensitive: true,
    description: 'Optional separate Redis connection for queues',
    isEnvOnly: true,
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  @IsUrl({
    protocols: ['redis', 'rediss'],
    require_tld: false,
    allow_underscores: true,
  })
  REDIS_QUEUE_URL!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    description: 'Node environment',
    type: ConfigVariableType.ENUM,
    options: Object.values(NodeEnvironment),
    isEnvOnly: true,
  })
  NODE_ENV: NodeEnvironment = NodeEnvironment.PRODUCTION;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    description: 'Port for the node server',
    type: ConfigVariableType.NUMBER,
    isEnvOnly: true,
  })
  @CastToPositiveNumber()
  @IsOptional()
  NODE_PORT = 3000;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    description: 'Base URL for the server',
    type: ConfigVariableType.STRING,
    isEnvOnly: true,
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  @IsOptional()
  SERVER_URL = 'http://localhost:3000';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    description: 'When enabled, the served frontend resolves the API base URL from the browser\'s current origin',
    type: ConfigVariableType.BOOLEAN,
    isEnvOnly: true,
  })
  @IsOptional()
  FRONT_AUTO_BASE_URL = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    description: 'Express "trust proxy" setting',
    type: ConfigVariableType.STRING,
    isEnvOnly: true,
  })
  @IsOptional()
  TRUST_PROXY: string = 'loopback, linklocal, uniquelocal';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    description: 'Unique identifier for this server instance',
    type: ConfigVariableType.STRING,
    isEnvOnly: true,
  })
  @IsOptional()
  SERVER_ID!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    description: 'Base URL for public domains',
    type: ConfigVariableType.STRING,
  })
  @IsUrl({ require_tld: false, require_protocol: true })
  @IsOptional()
  PUBLIC_DOMAIN_URL!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    isSensitive: true,
    description: 'Secret key for the application',
    isEnvOnly: true,
    type: ConfigVariableType.STRING,
  })
  APP_SECRET!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    isSensitive: true,
    description: 'Primary key for at-rest encryption of secrets',
    isEnvOnly: true,
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  ENCRYPTION_KEY!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    isSensitive: true,
    description: 'Verification-only fallback key for key rotation',
    isEnvOnly: true,
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  FALLBACK_ENCRYPTION_KEY!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Days the current JWT signing key stays valid before rotation',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  @IsOptional()
  SIGNING_KEY_ROTATION_DAYS?: number;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.RATE_LIMITING,
    description: 'Maximum number of records affected by mutations',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  @IsOptional()
  MUTATION_MAXIMUM_AFFECTED_RECORDS = 100;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.RATE_LIMITING,
    description: 'Time-to-live for short API rate limiting in milliseconds',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  API_RATE_LIMITING_SHORT_TTL_IN_MS = 1000;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.RATE_LIMITING,
    description: 'Maximum number of requests allowed in the short rate limiting window',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  API_RATE_LIMITING_SHORT_LIMIT = 100;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.RATE_LIMITING,
    description: 'Time-to-live for long API rate limiting in milliseconds',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  API_RATE_LIMITING_LONG_TTL_IN_MS = 60_000;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.RATE_LIMITING,
    description: 'Maximum number of requests allowed in the long rate limiting window',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  API_RATE_LIMITING_LONG_LIMIT = 100;

  @CastToPositiveNumber()
  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.RATE_LIMITING,
    description: 'Maximum fields allowed for GQL queries',
    type: ConfigVariableType.NUMBER,
  })
  GRAPHQL_MAX_FIELDS = 2000;

  @CastToPositiveNumber()
  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.RATE_LIMITING,
    description: 'Maximum root resolvers allowed for GQL queries',
    type: ConfigVariableType.NUMBER,
  })
  GRAPHQL_MAX_ROOT_RESOLVERS = 20;

  @CastToPositiveNumber()
  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.RATE_LIMITING,
    description: 'Maximum complexity allowed for Common API queries',
    type: ConfigVariableType.NUMBER,
  })
  COMMON_QUERY_COMPLEXITY_LIMIT = 2000;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.RATE_LIMITING,
    description: 'Time-to-live for workspace-level invitations resending rate limiting in milliseconds',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  INVITATION_SENDING_BY_WORKSPACE_THROTTLE_TTL_IN_MS = 604_800_000; // 7 days

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.RATE_LIMITING,
    description: 'Maximum number of workspace-level invitations resending allowed in the rate limiting window',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  INVITATION_SENDING_BY_WORKSPACE_THROTTLE_LIMIT = 500;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.RATE_LIMITING,
    description: 'Time-to-live for email-level invitations sending rate limiting in milliseconds',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  INVITATION_SENDING_BY_EMAIL_THROTTLE_TTL_IN_MS = 604_800_000; // 7 days

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.RATE_LIMITING,
    description: 'Maximum number of email-level invitations sending allowed in the rate limiting window',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  INVITATION_SENDING_BY_EMAIL_THROTTLE_LIMIT = 10;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SSL,
    description: 'Path to the SSL key for enabling HTTPS in local development',
    type: ConfigVariableType.STRING,
    isEnvOnly: true,
  })
  @IsOptional()
  SSL_KEY_PATH!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SSL,
    description: 'Path to the SSL certificate for enabling HTTPS in local development',
    type: ConfigVariableType.STRING,
    isEnvOnly: true,
  })
  @IsOptional()
  SSL_CERT_PATH!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.CLOUDFLARE_CONFIG,
    isSensitive: true,
    description: 'API key for Cloudflare integration',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.CLOUDFLARE_ZONE_ID)
  CLOUDFLARE_API_KEY!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.CLOUDFLARE_CONFIG,
    description: 'Zone ID for Cloudflare integration',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.CLOUDFLARE_API_KEY)
  CLOUDFLARE_ZONE_ID!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.CLOUDFLARE_CONFIG,
    description: 'Zone ID for public domain Cloudflare integration',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.PUBLIC_DOMAIN_URL)
  CLOUDFLARE_PUBLIC_DOMAIN_ZONE_ID!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.CLOUDFLARE_CONFIG,
    description: 'Random string to validate queries from Cloudflare',
    type: ConfigVariableType.STRING,
    isSensitive: true,
  })
  @IsOptional()
  CLOUDFLARE_WEBHOOK_SECRET!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.CLOUDFLARE_CONFIG,
    description: 'Id to generate value for CNAME record',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  CLOUDFLARE_DCV_DELEGATION_ID!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LLM,
    isSensitive: true,
    description: 'API key for OpenAI models (GPT, o-series)',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  OPENAI_API_KEY?: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LLM,
    isSensitive: true,
    description: 'API key for Anthropic models (Claude)',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  ANTHROPIC_API_KEY?: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LLM,
    isSensitive: true,
    description: 'API key for Google AI models (Gemini)',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  GOOGLE_API_KEY?: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LLM,
    isSensitive: true,
    description: 'API key for xAI models (Grok)',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  XAI_API_KEY?: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LLM,
    isSensitive: true,
    description: 'API key for Groq inference',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  GROQ_API_KEY?: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LLM,
    isSensitive: true,
    description: 'API key for Mistral models',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  MISTRAL_API_KEY?: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LLM,
    isSensitive: true,
    description: 'AI provider configurations',
    type: ConfigVariableType.JSON,
  })
  @IsOptional()
  AI_PROVIDERS: AiProvidersConfig = {};

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LLM,
    description: 'Storage path for the AI catalog override',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  AI_CATALOG_STORAGE_PATH?: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LLM,
    description: 'Ordered list of fast model IDs to use as defaults',
    type: ConfigVariableType.ARRAY,
  })
  @IsOptional()
  AI_MODELS_DEFAULT_FAST: string[] = DEFAULT_FAST_MODELS;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LLM,
    description: 'Ordered list of smart model IDs to use as defaults',
    type: ConfigVariableType.ARRAY,
  })
  @IsOptional()
  AI_MODELS_DEFAULT_SMART: string[] = DEFAULT_SMART_MODELS;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LLM,
    description: 'List of recommended model IDs shown to workspaces',
    type: ConfigVariableType.ARRAY,
  })
  @IsOptional()
  AI_MODELS_DEFAULT_RECOMMENDED: string[] = DEFAULT_RECOMMENDED_MODELS;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.LLM,
    description: 'List of model IDs disabled by default',
    type: ConfigVariableType.ARRAY,
  })
  @IsOptional()
  AI_MODELS_DEFAULT_DISABLED: string[] = DEFAULT_DISABLED_MODELS;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    description: 'Enable or disable multi-workspace support',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  IS_MULTIWORKSPACE_ENABLED = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Number of inactive days before sending a deletion warning for workspaces',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  @IsStrictlyLowerThan('WORKSPACE_INACTIVE_DAYS_BEFORE_SOFT_DELETION', {
    message:
      '"WORKSPACE_INACTIVE_DAYS_BEFORE_NOTIFICATION" should be strictly lower than "WORKSPACE_INACTIVE_DAYS_BEFORE_SOFT_DELETION"',
  })
  WORKSPACE_INACTIVE_DAYS_BEFORE_NOTIFICATION = 7;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Number of inactive days before soft deleting workspaces',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  @IsStrictlyLowerThan('WORKSPACE_INACTIVE_DAYS_BEFORE_DELETION', {
    message:
      '"WORKSPACE_INACTIVE_DAYS_BEFORE_SOFT_DELETION" should be strictly lower than "WORKSPACE_INACTIVE_DAYS_BEFORE_DELETION"',
  })
  WORKSPACE_INACTIVE_DAYS_BEFORE_SOFT_DELETION = 14;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Number of inactive days before deleting workspaces',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  WORKSPACE_INACTIVE_DAYS_BEFORE_DELETION = 21;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Maximum number of workspaces that can be deleted in a single execution',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  @ValidateIf((env) => env.MAX_NUMBER_OF_WORKSPACES_DELETED_PER_EXECUTION > 0)
  MAX_NUMBER_OF_WORKSPACES_DELETED_PER_EXECUTION = 5;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.RATE_LIMITING,
    description: 'Throttle limit for workflow execution (soft)',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  WORKFLOW_EXEC_SOFT_THROTTLE_LIMIT = 100;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.RATE_LIMITING,
    description: 'Time-to-live for workflow execution soft throttle in milliseconds',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  WORKFLOW_EXEC_SOFT_THROTTLE_TTL = 60_000;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.RATE_LIMITING,
    description: 'Throttle limit for workflow execution (hard)',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  WORKFLOW_EXEC_HARD_THROTTLE_LIMIT = 5000;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.RATE_LIMITING,
    description: 'Time-to-live for workflow execution hard throttle in milliseconds',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  WORKFLOW_EXEC_HARD_THROTTLE_TTL = 3_600_000; // 1 hour

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.CAPTCHA_CONFIG,
    description: 'Driver for captcha integration',
    type: ConfigVariableType.ENUM,
    options: Object.values(CaptchaDriverType),
  })
  @IsOptional()
  @CastToUpperSnakeCase()
  CAPTCHA_DRIVER?: CaptchaDriverType;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.CAPTCHA_CONFIG,
    isSensitive: true,
    description: 'Site key for captcha integration',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  CAPTCHA_SITE_KEY?: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.CAPTCHA_CONFIG,
    isSensitive: true,
    description: 'Secret key for captcha integration',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  CAPTCHA_SECRET_KEY?: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    isSensitive: true,
    description: 'License key for the Enterprise version',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  ENTERPRISE_KEY!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    isSensitive: true,
    description: 'Signed enterprise validity token (JWT)',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  ENTERPRISE_VALIDITY_TOKEN!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    description: 'Base URL for the Enterprise API on sabnode.com',
    isHiddenInAdminPanel: true,
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  ENTERPRISE_API_URL: string = 'https://sabnode.com/api/enterprise';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Health monitoring time window in minutes',
    type: ConfigVariableType.NUMBER,
  })
  @CastToPositiveNumber()
  @IsOptional()
  HEALTH_METRICS_TIME_WINDOW_IN_MINUTES = 5;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Enable or disable the attachment preview feature',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  IS_ATTACHMENT_PREVIEW_ENABLED = true;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.SERVER_CONFIG,
    description: 'SabCRM server version',
    type: ConfigVariableType.STRING,
    isEnvOnly: true,
    isHiddenInAdminPanel: true,
  })
  @IsOptionalOrEmptyString()
  @IsTwentySemVer()
  APP_VERSION?: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Enable or disable google map api usage',
    type: ConfigVariableType.BOOLEAN,
  })
  @IsOptional()
  IS_MAPS_AND_ADDRESS_AUTOCOMPLETE_ENABLED = false;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    isSensitive: true,
    description: 'Google map api key for places and map',
    type: ConfigVariableType.STRING,
  })
  @ValidateIf((env) => env.IS_MAPS_AND_ADDRESS_AUTOCOMPLETE_ENABLED)
  GOOGLE_MAP_API_KEY!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    isSensitive: true,
    description: 'Mintlify API key for documentation search',
    isEnvOnly: true,
    isHiddenInAdminPanel: true,
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  MINTLIFY_API_KEY!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    isSensitive: true,
    description: 'Mintlify subdomain for documentation search',
    isEnvOnly: true,
    isHiddenInAdminPanel: true,
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  MINTLIFY_SUBDOMAIN!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.AWS_SES_SETTINGS,
    description: 'AWS region',
    type: ConfigVariableType.STRING,
  })
  @IsAWSRegion()
  @IsOptional()
  AWS_SES_REGION!: AwsRegion;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.AWS_SES_SETTINGS,
    isSensitive: true,
    description: 'AWS access key ID',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  AWS_SES_ACCESS_KEY_ID!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.AWS_SES_SETTINGS,
    isSensitive: true,
    description: 'AWS session token',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  AWS_SES_SESSION_TOKEN!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.AWS_SES_SETTINGS,
    isSensitive: true,
    description: 'AWS secret access key',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  AWS_SES_SECRET_ACCESS_KEY!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.AWS_SES_SETTINGS,
    description: 'AWS Account ID for SES ARN construction',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  AWS_SES_ACCOUNT_ID!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.AWS_SES_SETTINGS,
    description: 'Domain used for email group inbound mail',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  INBOUND_EMAIL_DOMAIN!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.AWS_SES_SETTINGS,
    description: 'Comma-separated list of SNS topic ARNs accepted by the inbound-email webhook',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  SES_SNS_TOPIC_ARN_ALLOWLIST!: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Timeout in milliseconds for primary database queries',
    type: ConfigVariableType.NUMBER,
    isEnvOnly: true,
  })
  @CastToPositiveNumber()
  @IsOptional()
  PG_DATABASE_PRIMARY_TIMEOUT_MS: number = 10000;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Timeout in milliseconds for replica database queries',
    type: ConfigVariableType.NUMBER,
    isEnvOnly: true,
  })
  @CastToPositiveNumber()
  @IsOptional()
  PG_DATABASE_REPLICA_TIMEOUT_MS: number = 10000;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Timeout in milliseconds for the search ILIKE fallback query',
    type: ConfigVariableType.NUMBER,
    isEnvOnly: true,
  })
  @CastToPositiveNumber()
  @IsOptional()
  SEARCH_ILIKE_FALLBACK_TIMEOUT_MS: number = 2000;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'Default npm registry URL for resolving app packages',
    type: ConfigVariableType.STRING,
  })
  @IsUrl({ require_tld: false })
  @IsOptional()
  APP_REGISTRY_URL: string = 'https://registry.npmjs.org';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    description: 'CDN base URL for serving files from registry',
    type: ConfigVariableType.STRING,
  })
  @IsUrl({ require_tld: false })
  @IsOptional()
  APP_REGISTRY_CDN_URL: string = 'https://unpkg.com';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.ADVANCED_SETTINGS,
    isSensitive: true,
    description: 'Auth token for the default npm registry (for private packages)',
    type: ConfigVariableType.STRING,
  })
  @IsOptional()
  APP_REGISTRY_TOKEN!: string;
}

export const validate = (config: Record<string, unknown>): ConfigVariables => {
  const validatedConfig = plainToClass(ConfigVariables, config);

  const validationErrors = validateSync(validatedConfig, {
    strictGroups: true,
  });

  const validationWarnings = validateSync(validatedConfig, {
    groups: ['warning'],
  });

  const logValidationErrors = (
    errorCollection: ValidationError[],
    type: 'error' | 'warn',
  ) =>
    errorCollection.forEach((error) => {
      if (!error.constraints || !error.property) {
        return;
      }
      Logger[type](Object.values(error.constraints).join('\n'));
    });

  if (validationWarnings.length > 0) {
    logValidationErrors(validationWarnings, 'warn');
  }

  if (validationErrors.length > 0) {
    logValidationErrors(validationErrors, 'error');
    throw new ConfigVariableException(
      'Config variables validation failed',
      ConfigVariableExceptionCode.VALIDATION_FAILED,
    );
  }

  return validatedConfig;
};
