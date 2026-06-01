// PORT-NOTE: NestJS createParamDecorator is not available in Next.js.
// Extract the auth provider from the request context directly in route handlers.

import { type AuthRequestContext } from "@/lib/sabcrm/server/src/engine/decorators/auth/auth-api-key.decorator";

/**
 * Extracts the auth provider from a SabCRM request context.
 * Equivalent of the NestJS @AuthProvider() param decorator.
 */
export function extractAuthProvider(ctx: AuthRequestContext): string | undefined {
  return ctx.authProvider;
}
