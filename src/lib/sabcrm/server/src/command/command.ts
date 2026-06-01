// PORT-NOTE: command.ts — Twenty CLI bootstrap (nest-commander).
// In SabNode (Next.js) there is no NestJS CLI process. Database and admin
// operations are instead triggered via Next.js server actions or dedicated
// API route handlers. This stub preserves the intent (error-captured CLI
// runner) for reference.

/**
 * Represents the error-handling options that the original bootstrap used.
 * Implement equivalents inside SabNode server actions / scripts as needed.
 */
export type CliBootstrapOptions = {
  /**
   * Whether the logger is operating in buffered mode.
   * Read from env: LOGGER_IS_BUFFER_ENABLED.
   */
  bufferLogs: boolean;
};

/**
 * shouldCaptureException is the original guard used before forwarding errors
 * to the exception handler. Port the real logic from the engine utils if
 * needed in server actions.
 */
export type ShouldCaptureException = (err: Error) => boolean;
