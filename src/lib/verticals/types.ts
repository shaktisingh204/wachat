/**
 * Verticals & Templates — domain types.
 *
 * A "vertical" is a packaged industry experience. Installing a vertical onto
 * a tenant seeds a domain data model, baseline automations, dashboards,
 * messaging templates, AI agents and contract boilerplate so the tenant can
 * be productive on day one without manual configuration.
 *
 * Industry-specific compliance hooks (HIPAA, FERPA, FINRA, GDPR, …) are
 * registered alongside the vertical so the rest of the platform can gate
 * sensitive operations on install.
 */

// ── Industry data model ─────────────────────────────────────────────────────

export type FieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'enum'
  | 'email'
  | 'phone'
  | 'url'
  | 'reference'
  | 'json';

export interface FieldDefinition {
  /** Stable, snake-case key used in storage. */
  key: string;
  /** Human readable label. */
  label: string;
  type: FieldType;
  /** Required at write time. */
  required?: boolean;
  /** PII / PHI / financial sensitive flag — drives redaction/encryption. */
  sensitive?: boolean;
  /** Allowed values for `enum` fields. */
  options?: string[];
  /** Target entity name for `reference` fields. */
  ref?: string;
  /** Inline help text for the field editor. */
  help?: string;
}

export interface EntityDefinition {
  /** Singular snake_case name (e.g. "patient", "lead"). */
  name: string;
  /** Pluralised display label (e.g. "Patients"). */
  label: string;
  /** What this entity represents. Surfaces in UI tooltips. */
  description?: string;
  fields: FieldDefinition[];
  /** Pipeline stages, when the entity has a CRM-style pipeline. */
  stages?: string[];
}

export interface IndustryDataModel {
  /** Stable id of the model (defaults to vertical id). */
  id: string;
  /** Top-level entities provisioned for the tenant. */
  entities: EntityDefinition[];
  /** Default tags applied to seed records for filtering. */
  defaultTags?: string[];
}

// ── Templates ───────────────────────────────────────────────────────────────

export interface BaselineFlow {
  id: string;
  name: string;
  /** Free-text description of what the flow does. */
  description: string;
  /** Trigger type used by SabFlow (e.g. "contact_created"). */
  trigger: string;
  /** Ordered list of step types ("send_message", "wait", "ai_call"…). */
  steps: string[];
  /** Optional category — used by the marketplace UI. */
  category?: string;
}

export interface DashboardWidget {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'funnel' | 'map' | 'feed';
  title: string;
  /** Source query, metric key or dataset slug. */
  source: string;
  /** Grid columns occupied (1–12). */
  width?: number;
}

export interface DashboardDefinition {
  id: string;
  name: string;
  /** Audience — drives visibility (owner, agent, manager…). */
  audience?: string;
  widgets: DashboardWidget[];
}

export interface AIAgentReference {
  /** Stable agent id resolvable through the agent registry. */
  id: string;
  /** Display name. */
  name: string;
  /** What the agent is responsible for in this vertical. */
  role: string;
  /** Default tools the agent should be granted. */
  tools?: string[];
}

export interface MessagingTemplate {
  id: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'voice' | 'rcs';
  name: string;
  /** Template body with {{handlebars}} variables. */
  body: string;
  /** Locale tag (e.g. "en", "en-US", "hi"). */
  locale?: string;
  /** Variables available to the template. */
  variables?: string[];
}

export interface ContractTemplate {
  id: string;
  name: string;
  /** Body of the contract with {{merge}} fields. */
  body: string;
  /** Required signers (counterparty, witness, custodian…). */
  signers: string[];
  /** Compliance regimes this contract is pre-vetted against. */
  jurisdictions?: string[];
}

export interface ComplianceHookRef {
  /** Hook id resolved against {@link compliance-hooks.ts}. */
  id: string;
  /** Human readable reason this hook is attached to the vertical. */
  reason: string;
  /** When this hook fires — install, write, export, message… */
  on: 'install' | 'write' | 'export' | 'message' | 'delete';
}

export interface RecommendedAddon {
  /** Marketplace app id or feature flag. */
  id: string;
  reason: string;
  /** Whether the addon is required for the vertical to function. */
  required?: boolean;
}

// ── Vertical ────────────────────────────────────────────────────────────────

export interface Vertical {
  id: string;
  name: string;
  industry: string;
  dataModel: IndustryDataModel;
  /** Pre-baked sample records keyed by entity name. */
  sampleData: Record<string, Array<Record<string, unknown>>>;
  baselineFlows: BaselineFlow[];
  dashboards: DashboardDefinition[];
  aiAgents: AIAgentReference[];
  complianceHooks: ComplianceHookRef[];
  messagingTemplates: MessagingTemplate[];
  contractTemplates: ContractTemplate[];
  recommendedAddons: RecommendedAddon[];
  /** Optional marketing copy for the marketplace listing. */
  description?: string;
  /** Iconography slug (matches an icon registered in the UI kit). */
  icon?: string;
}

// ── Generic template envelope ───────────────────────────────────────────────

/**
 * A {@link VerticalTemplate} is a partial vertical that can be merged into a
 * tenant. The `installVertical` helper applies the full vertical, but ad-hoc
 * templates (e.g. a single flow pack or a dashboard pack) can be applied via
 * {@link template-engine.applyTemplate}.
 */
export interface VerticalTemplate {
  id: string;
  /** Display name for the template (e.g. "Holiday Promo Pack"). */
  name: string;
  /** Vertical this template targets (or "*" for any). */
  vertical: string | '*';
  /** Partial vertical payload to merge. */
  payload: Partial<Omit<Vertical, 'id' | 'name' | 'industry' | 'dataModel'>> & {
    /** When present, augments (does not replace) the data model. */
    dataModel?: Partial<IndustryDataModel>;
  };
}

// ── Install result ──────────────────────────────────────────────────────────

export interface InstallReport {
  verticalId: string;
  tenantId: string;
  installedAt: string;
  entitiesProvisioned: string[];
  flowsInstalled: number;
  dashboardsInstalled: number;
  templatesInstalled: number;
  warnings: string[];
}
