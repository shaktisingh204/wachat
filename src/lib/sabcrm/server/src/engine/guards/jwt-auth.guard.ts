import "server-only";

// PORT-NOTE: Ported from twenty-server JwtAuthGuard.
// NestJS DI/ExecutionContext removed. Accepts a plain Request-like object.
// Callers must supply validateTokenByRequest and getMetadataVersion callbacks
// that wrap the corresponding services (AccessTokenService,
// WorkspaceCacheStorageService) — these live in the ported server-logic layer.

export type WorkspaceAuthData = {
  workspace?: { id: string };
  apiKey?: unknown;
  userWorkspaceId?: string;
  application?: unknown;
  [key: string]: unknown;
};

export type ValidateTokenFn = (
  request: Request,
) => Promise<WorkspaceAuthData>;

export type GetMetadataVersionFn = (workspaceId: string) => Promise<number | undefined>;

export type BindDataToRequestFn = (
  data: WorkspaceAuthData,
  request: Request,
  metadataVersion: number | undefined,
) => void;

export class JwtAuthGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwtAuthGuardError";
  }
}

/**
 * Validates the JWT in `request` and binds workspace/user data onto it.
 * Returns false (unauthenticated) if validation fails — does NOT throw.
 */
export async function jwtAuthGuard(
  request: Request,
  validateToken: ValidateTokenFn,
  getMetadataVersion: GetMetadataVersionFn,
  bindDataToRequest: BindDataToRequestFn,
): Promise<boolean> {
  try {
    const data = await validateToken(request);

    const metadataVersion = data.workspace
      ? await getMetadataVersion(data.workspace.id)
      : undefined;

    if (
      data.apiKey === undefined &&
      data.userWorkspaceId === undefined &&
      data.application === undefined
    ) {
      console.warn(
        "JwtAuthGuard: no apiKey, userWorkspaceId, or application in context",
      );
      return false;
    }

    bindDataToRequest(data, request, metadataVersion);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`JwtAuthGuard: auth failed: ${errorMessage}`);
    return false;
  }
}
