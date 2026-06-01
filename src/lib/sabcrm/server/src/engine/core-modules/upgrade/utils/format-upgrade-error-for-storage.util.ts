// PORT-NOTE: Twenty-server specific exception types (QueryFailedError,
// WorkspaceMigrationRunnerException, WorkspaceMigrationBuilderException)
// are not present in SabNode. Those branches are preserved as plain Error
// handling. CustomError from twenty-shared is replaced with a generic
// duck-typed check for { code } on Error objects.

const MAX_ERROR_MESSAGE_LENGTH = 10_000;

const formatStack = (stack: string | undefined): string => {
  return (stack ?? "").split("\n").slice(1).join("\n");
};

const joinParts = (parts: (string | null)[]): string => {
  const joined = parts.filter(Boolean).join("\n");

  if (joined.length <= MAX_ERROR_MESSAGE_LENGTH) {
    return joined;
  }

  return joined.slice(0, MAX_ERROR_MESSAGE_LENGTH) + "\n[truncated]";
};

type ErrorWithCode = Error & { code?: string | number };

const buildErrorParts = (error: unknown): (string | null)[] => {
  if (error instanceof Error) {
    const e = error as ErrorWithCode;

    return [
      `[Error] ${e.message}`,
      e.code != null ? `Code: ${e.code}` : null,
      formatStack(e.stack),
    ];
  }

  return [String(error)];
};

export const formatUpgradeErrorForStorage = (error: unknown): string => {
  return joinParts(buildErrorParts(error));
};
