// PORT-NOTE: Ported from twenty-server NoPermissionGuard.
// NestJS CanActivate interface removed — guard becomes a no-op marker exported
// as a plain object/class so call-sites retain the same import shape.
// Always returns true; its purpose is purely as documentation that the endpoint
// intentionally bypasses standard permission validation.
//
// Use ONLY for:
// - Workspace initialization/onboarding flows
// - Public or semi-public endpoints
// - Self-service operations that don't require elevated permissions
//
// WARNING: Use sparingly! Most mutations should use SettingsPermissionGuard.
// If unsure, use CustomPermissionGuard and implement checks in the method.

export class NoPermissionGuard {
  canActivate(): boolean {
    return true;
  }
}
