// PORT-NOTE: Ported from twenty-server engine guards.
// NestJS CanActivate interface is preserved as a plain type contract.
// In SabNode/Next.js, guards are used as middleware-style functions or
// invoked directly from server actions/route handlers rather than via
// NestJS DI. This guard always returns true — it is a documentation marker
// indicating the endpoint has custom permission logic inside the handler.

export interface CanActivate {
  canActivate(...args: unknown[]): boolean | Promise<boolean>;
}

/**
 * Guard that explicitly marks an endpoint as having custom permission logic.
 * Always returns true — serves as documentation that the endpoint has custom
 * permission checks implemented within the resolver/handler method itself.
 *
 * Use when you need custom permission validation that cannot be expressed
 * with standard SettingsPermissionGuard:
 * - Self-only operations (users can only modify their own data)
 * - Complex permission logic (multiple conditions)
 * - Dynamic permission requirements (depends on object type, record ownership, etc.)
 */
export class CustomPermissionGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}
