// PORT-NOTE: NestJS createParamDecorator is not available in Next.js.
// In Next.js API routes / Server Actions, extract the api key from the
// incoming request directly (e.g. request.headers['x-api-key'] or a session).
// This module exports a plain helper that reads apiKey from a typed request
// context object — wire it into your route handler manually.

export type AuthRequestContext = {
  apiKey?: unknown;
  user?: unknown;
  workspace?: unknown;
  workspaceId?: string;
  userWorkspaceId?: string;
  workspaceMemberId?: string;
  authProvider?: string;
  locale?: string;
};

/**
 * Extracts the API key from a SabCRM request context.
 * Equivalent of the NestJS @AuthApiKey() param decorator.
 */
export function extractAuthApiKey(ctx: AuthRequestContext): unknown {
  return ctx.apiKey;
}
