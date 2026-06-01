// PORT-NOTE: NestJS createParamDecorator is not available in Next.js.
// In Next.js route handlers or server actions, call extractAuthUserWorkspaceId()
// with the request context and handle the thrown error yourself.

import { type AuthRequestContext } from "@/lib/sabcrm/server/src/engine/decorators/auth/auth-api-key.decorator";

export type AuthUserWorkspaceIdOptions = {
  allowUndefined?: boolean;
};

/**
 * Extracts userWorkspaceId from a SabCRM request context.
 * Throws if undefined and allowUndefined is false/unset.
 * Equivalent of the NestJS @AuthUserWorkspaceId() param decorator.
 */
export function extractAuthUserWorkspaceId(
  ctx: AuthRequestContext,
  options?: AuthUserWorkspaceIdOptions,
): string | undefined {
  if (!options?.allowUndefined && !ctx.userWorkspaceId) {
    throw new Error(
      "This endpoint requires a user context. API keys are not supported.",
    );
  }

  return ctx.userWorkspaceId;
}
