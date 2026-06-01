// PORT-NOTE: NestJS module → SabNode registry/index.
// WorkspaceSSOModule wired: SSO service functions (exported) + SSO resolver actions.
// No DI container in Next.js; re-export the ported pieces so consumers
// can import from this single entry-point.

export * from '@/lib/sabcrm/server/src/engine/core-modules/sso/services/sso.service';
export { WorkspaceSSOIdentityProviderDocument } from '@/lib/sabcrm/server/src/engine/core-modules/sso/workspace-sso-identity-provider.entity';
export * from '@/lib/sabcrm/server/src/engine/core-modules/sso/sso.exception';
