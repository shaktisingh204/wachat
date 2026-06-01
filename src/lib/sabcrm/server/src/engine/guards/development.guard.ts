import "server-only";

// PORT-NOTE: Ported from twenty-server DevelopmentGuard.
// NestJS DI replaced with plain exported function. TwentyConfigService replaced
// with direct process.env read. ForbiddenException becomes a standard Error.

export class DevelopmentGuardError extends Error {
  constructor() {
    super("This endpoint is only available in development or test environments");
    this.name = "DevelopmentGuardError";
  }
}

/**
 * Throws if the current Node environment is not development or test.
 * Call at the top of any route handler / server action restricted to dev/test.
 */
export function assertDevelopmentOrTest(): void {
  const nodeEnv = process.env.NODE_ENV;

  if (nodeEnv !== "development" && nodeEnv !== "test") {
    throw new DevelopmentGuardError();
  }
}
