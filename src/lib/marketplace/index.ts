/**
 * App Marketplace barrel.
 */

export * from './types';
export {
  getMarketplaceCollection,
  registerApp,
  validateManifest,
  listApps,
  getApp,
} from './registry';
export type {
  ManifestValidationError,
  ManifestValidationResult,
  RegisterAppOptions,
} from './registry';
export {
  installApp,
  uninstallApp,
  listInstallsForTenant,
  getInstall,
  getInstallsCollection,
  fireAuditEvent,
} from './install';
export type { InstallAppOptions } from './install';
export { gates, isKnownScope, KNOWN_SCOPES } from './permissions';
export type { ScopeGateResult, KnownScope } from './permissions';
// Legacy raw recorders (write directly to `marketplace_usage`). Kept available
// under unique names so the modern usage-bridge API can own the unqualified
// `recordAppUsage` / `commissionForInstall` symbols.
export {
  recordAppUsage as recordRawAppUsage,
  commissionForInstall as computeCommissionSplit,
  DEFAULT_DEVELOPER_BPS,
} from './billing';
export type { CommissionSplit, UsageRecord } from './billing';

// Modern usage-bridge API — meters through @/lib/billing/usage-meter and
// queues partner payouts. This is the version every new caller should use.
export {
  recordAppUsage,
  recordAppRefund,
  commissionForInstall,
  queuePartnerPayoutDue,
  featureKey,
} from './usage-bridge';
export type {
  RecordAppUsageInput,
  RecordAppUsageResult,
  CommissionResult,
  PartnerPayoutDueEvent,
} from './usage-bridge';

export { onInstall, onUninstall } from './lifecycle';
export type { LifecycleResult } from './lifecycle';
