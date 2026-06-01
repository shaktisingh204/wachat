// PORT-NOTE: Ported from twenty-server PublicEndpointGuard.
// NestJS CanActivate interface removed — guard is a no-op marker class
// preserved so imports stay consistent across the ported codebase.
// Endpoints decorated/tagged with this guard are intentionally accessible
// without authentication.

/**
 * Guard marker for public/unprotected endpoints.
 * Always returns true. Its sole purpose is to document that the endpoint
 * is intentionally accessible without authentication.
 *
 * Usage: instantiate or reference at the route handler level.
 */
export class PublicEndpointGuard {
  canActivate(): boolean {
    // Always allow access — this is an explicit marker for public endpoints.
    return true;
  }
}
