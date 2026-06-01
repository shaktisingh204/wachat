import "server-only";

// service: GmailEmailAliasErrorHandlerService → plain exported function
// Handles Gmail API errors when fetching email aliases.

// PORT-NOTE: The original service depended on:
//   - MessageImportDriverException / MessageImportDriverExceptionCode
//   - isGmailApiError, parseGmailApiError
//   - isGmailNetworkError, parseGmailNetworkError
// These are ported under src/lib/sabcrm/server/src/modules/messaging/message-import-manager/drivers/gmail/

// Inline exception class to avoid a deep import chain here; callers may
// replace this with the fully-ported exception once messaging is ported.
export class MessageImportDriverException extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "MessageImportDriverException";
  }
}

export const MessageImportDriverExceptionCode = {
  UNKNOWN: "UNKNOWN",
  TEMPORARY_ERROR: "TEMPORARY_ERROR",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
} as const;
export type MessageImportDriverExceptionCode =
  (typeof MessageImportDriverExceptionCode)[keyof typeof MessageImportDriverExceptionCode];

// Minimal network-error detector (port of is-gmail-network-error.util.ts)
function isGmailNetworkError(
  error: unknown,
): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as Record<string, unknown>).code === "string" &&
    [
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
      "ECONNREFUSED",
    ].includes((error as { code: string }).code)
  );
}

// Minimal API-error detector (port of is-gmail-api-error.util.ts)
function isGmailApiError(
  error: unknown,
): error is { response?: { status?: number; data?: unknown } } {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as Record<string, unknown>).response === "object"
  );
}

export function handleGmailEmailAliasError(error: unknown): never {
  const constructorName =
    (error as unknown as { constructor?: { name?: string } })?.constructor
      ?.name ?? "Unknown";

  console.error(
    `Google: Error getting email aliases: ${error}, constructor: ${constructorName}`,
  );

  if (isGmailNetworkError(error)) {
    throw new MessageImportDriverException(
      `Gmail network error: ${error.code} - ${error.message}`,
      MessageImportDriverExceptionCode.TEMPORARY_ERROR,
    );
  }

  if (isGmailApiError(error)) {
    throw new MessageImportDriverException(
      `Gmail API error: ${JSON.stringify((error as { response?: unknown }).response)}`,
      MessageImportDriverExceptionCode.UNKNOWN,
    );
  }

  throw new MessageImportDriverException(
    `Google email alias error: ${error instanceof Error ? error.message : String(error)}`,
    MessageImportDriverExceptionCode.UNKNOWN,
  );
}
