// PORT-NOTE: NestJS createParamDecorator is not available in Next.js.
// Call extractAuthWorkspace() in route handlers/server actions.

import { type AuthRequestContext } from "@/lib/sabcrm/server/src/engine/decorators/auth/auth-api-key.decorator";

export type AuthWorkspaceOptions = {
  allowUndefined?: boolean;
};

/**
 * Extracts the authenticated workspace from a SabCRM request context.
 * Throws an internal error if workspace is absent and allowUndefined is false/unset.
 * Equivalent of the NestJS @AuthWorkspace() param decorator.
 */
export function extractAuthWorkspace(
  ctx: AuthRequestContext,
  options?: AuthWorkspaceOptions,
): unknown {
  if (!options?.allowUndefined && !ctx.workspace) {
    // Mirror the original: throw an internal error (not 403) — auth should be
    // enforced by guards/middleware before this helper is called.
    throw new Error(
      "You're not authorized to do this. This should not ever happen.",
    );
  }

  return ctx.workspace;
}
