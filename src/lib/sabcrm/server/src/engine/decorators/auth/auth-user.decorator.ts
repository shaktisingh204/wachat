// PORT-NOTE: NestJS createParamDecorator is not available in Next.js.
// In Next.js route handlers or server actions, call extractAuthUser() with the
// request context and handle the thrown error yourself.

import { type AuthRequestContext } from "@/lib/sabcrm/server/src/engine/decorators/auth/auth-api-key.decorator";

export type AuthUserOptions = {
  allowUndefined?: boolean;
};

/**
 * Extracts the authenticated user from a SabCRM request context.
 * Throws if user is absent and allowUndefined is false/unset.
 * Equivalent of the NestJS @AuthUser() param decorator.
 */
export function extractAuthUser(
  ctx: AuthRequestContext,
  options?: AuthUserOptions,
): unknown {
  if (!options?.allowUndefined && !ctx.user) {
    throw new Error(
      "You're not authorized to do this. " +
        "Note: This endpoint requires a user and won't work with just an API key.",
    );
  }

  return ctx.user;
}
