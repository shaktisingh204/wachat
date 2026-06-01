// PORT-NOTE: NestJS createParamDecorator is not available in Next.js.
// Extract the locale from the request context in route handlers/server actions.

import { type AuthRequestContext } from "@/lib/sabcrm/server/src/engine/decorators/auth/auth-api-key.decorator";

/**
 * Extracts the request locale from a SabCRM request context.
 * Equivalent of the NestJS @RequestLocale() param decorator.
 */
export function extractRequestLocale(
  ctx: AuthRequestContext,
): string | undefined {
  return ctx.locale;
}
