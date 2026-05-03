/**
 * Verticals & Templates — public barrel.
 *
 * Importing from `@/lib/verticals` (or this file directly) registers every
 * packaged vertical as a side-effect, so callers can immediately invoke
 * `installVertical("retail", tenantId)` without touching the individual
 * vertical files.
 */

import { registerVertical } from './registry';
import { AGENCIES_VERTICAL } from './verticals/agencies';
import { AUTOMOTIVE_VERTICAL } from './verticals/automotive';
import { EDUCATION_VERTICAL } from './verticals/education';
import { FITNESS_VERTICAL } from './verticals/fitness';
import { HEALTHCARE_VERTICAL } from './verticals/healthcare';
import { LEGAL_VERTICAL } from './verticals/legal';
import { NON_PROFIT_VERTICAL } from './verticals/non-profit';
import { REAL_ESTATE_VERTICAL } from './verticals/real-estate';
import { RESTAURANTS_VERTICAL } from './verticals/restaurants';
import { RETAIL_VERTICAL } from './verticals/retail';

// ── Side-effect registration ────────────────────────────────────────────────

const ALL_VERTICALS = [
  RETAIL_VERTICAL,
  HEALTHCARE_VERTICAL,
  REAL_ESTATE_VERTICAL,
  EDUCATION_VERTICAL,
  AGENCIES_VERTICAL,
  RESTAURANTS_VERTICAL,
  LEGAL_VERTICAL,
  NON_PROFIT_VERTICAL,
  FITNESS_VERTICAL,
  AUTOMOTIVE_VERTICAL,
];

for (const v of ALL_VERTICALS) {
  registerVertical(v);
}

// ── Re-exports ──────────────────────────────────────────────────────────────

export type {
  Vertical,
  VerticalTemplate,
  IndustryDataModel,
  EntityDefinition,
  FieldDefinition,
  FieldType,
  BaselineFlow,
  DashboardDefinition,
  DashboardWidget,
  AIAgentReference,
  MessagingTemplate,
  ContractTemplate,
  ComplianceHookRef,
  RecommendedAddon,
  InstallReport,
} from './types';

export {
  registerVertical,
  unregisterVertical,
  getVertical,
  listVerticals,
  installVertical,
  setInstallTransport,
  getInstallTransport,
  TraceTransport,
} from './registry';

export type { InstallTransport, InstallOptions } from './registry';

export {
  applyTemplate,
  validateTemplate,
} from './template-engine';

export {
  listMarketplace,
  getMarketplaceListing,
  installFromMarketplace,
  uninstallVertical,
  setUninstallTransport,
  TraceUninstallTransport,
} from './vertical-marketplace';

export type { MarketplaceListing, InstallRequest, UninstallTransport } from './vertical-marketplace';

export {
  registerHook,
  getHook,
  listHooks,
  runHook,
  redactPHI,
} from './compliance-hooks';

export type { ComplianceContext, ComplianceVerdict, ComplianceHook } from './compliance-hooks';

export {
  RETAIL_VERTICAL,
  HEALTHCARE_VERTICAL,
  REAL_ESTATE_VERTICAL,
  EDUCATION_VERTICAL,
  AGENCIES_VERTICAL,
  RESTAURANTS_VERTICAL,
  LEGAL_VERTICAL,
  NON_PROFIT_VERTICAL,
  FITNESS_VERTICAL,
  AUTOMOTIVE_VERTICAL,
};
