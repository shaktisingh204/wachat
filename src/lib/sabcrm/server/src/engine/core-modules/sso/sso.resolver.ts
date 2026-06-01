import 'server-only';

// PORT-NOTE: NestJS GraphQL resolver → Next.js "use server" action module.
// Each @Mutation/@Query becomes an exported async function.
// Guards (WorkspaceAuthGuard, EnterpriseFeaturesEnabledGuard,
// SettingsPermissionGuard) are left as a comment; callers must enforce
// RBAC/entitlement before calling these functions.
// The sso.service is function-based (not a class) — re-exported here.

export {
  createOIDCIdentityProvider,
  createSAMLIdentityProvider,
  getSSOIdentityProviders,
  deleteSSOIdentityProvider,
  editSSOIdentityProvider,
  findSSOIdentityProviderById,
  getAuthorizationUrlForSSO,
  getOIDCClient,
  buildIssuerURL,
} from '@/lib/sabcrm/server/src/engine/core-modules/sso/services/sso.service';
