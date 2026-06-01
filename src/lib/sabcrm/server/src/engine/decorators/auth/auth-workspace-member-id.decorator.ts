// PORT-NOTE: NestJS createParamDecorator is not available in Next.js.
// Call extractAuthWorkspaceMemberId() in route handlers/server actions.

import { type AuthRequestContext } from "@/lib/sabcrm/server/src/engine/decorators/auth/auth-api-key.decorator";

/**
 * Extracts the workspace member id from a SabCRM request context.
 * Equivalent of the NestJS @AuthWorkspaceMemberId() param decorator.
 */
export function extractAuthWorkspaceMemberId(
  ctx: AuthRequestContext,
): string | undefined {
  return ctx.workspaceMemberId;
}
