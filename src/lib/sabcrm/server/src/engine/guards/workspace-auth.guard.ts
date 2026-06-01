// PORT-NOTE: Ported from twenty-server WorkspaceAuthGuard.
// NestJS removed. Guard becomes a plain predicate that checks whether a
// workspace object is attached to the request-like context.

export type WorkspaceAuthContext = {
  workspace?: unknown;
};

/**
 * Returns true when the context carries a valid workspace object.
 * Returns false when the context is absent or workspace is not set.
 */
export function workspaceAuthGuard(ctx: WorkspaceAuthContext | null | undefined): boolean {
  if (!ctx) return false;
  if (!ctx.workspace) return false;
  return true;
}
