/**
 * CRM Depth — domain types for advanced pipelines, deals, scoring, lead routing,
 * e-signature, quotes, contracts, sequences, playbooks, meetings, forecasting,
 * win/loss reasons and customer health.
 *
 * These are pure TypeScript types and have no runtime dependencies.
 */

export type ISODateString = string;

// ---------------------------------------------------------------------------
// Pipeline + Stage
// ---------------------------------------------------------------------------

export type StageType =
  | 'open'
  | 'won'
  | 'lost'
  | 'on-hold'
  | 'nurture';

export interface Stage {
  id: string;
  name: string;
  /** Display order within the pipeline (lower = earlier). */
  order: number;
  /** Default probability (0-100) used by weighted forecasting. */
  probability: number;
  /** Stage classification — controls forecast/funnel logic. */
  type: StageType;
  /** Optional SLA: max hours allowed in this stage before flagged. */
  slaHours?: number;
  /** Optional checklist items (next-best-actions). */
  requirements?: string[];
  color?: string;
}

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  /** Industry vertical key — useful for templating. */
  industry?: string;
  stages: Stage[];
  /** ISO currency code (USD, EUR, INR). */
  currency?: string;
  isDefault?: boolean;
  createdAt?: ISODateString;
}

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

export type DealStatus = 'open' | 'won' | 'lost' | 'abandoned';

export interface Deal {
  id: string;
  pipelineId: string;
  stageId: string;
  name: string;
  amount: number;
  currency: string;
  ownerId: string;
  contactId?: string;
  accountId?: string;
  status: DealStatus;
  /** Estimated close date. */
  expectedCloseDate?: ISODateString;
  closedAt?: ISODateString;
  /** Confidence override (0-100); falls back to stage probability. */
  probability?: number;
  /** Forecast classification — used by `forecastRevenue`. */
  forecastCategory?: 'best-case' | 'commit' | 'pipeline' | 'omitted';
  source?: string;
  tags?: string[];
  /** Free-form custom fields. */
  fields?: Record<string, unknown>;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}

export interface DealScoreBreakdown {
  signal: string;
  weight: number;
  rawValue: number;
  contribution: number;
}

export interface DealScore {
  dealId: string;
  /** 0-100 normalised score. */
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: DealScoreBreakdown[];
  computedAt: ISODateString;
  recommendedActions: string[];
}

export interface SignalWeight {
  /** Stable signal key e.g. `engagement`, `seniority`, `budget`. */
  signal: string;
  weight: number;
  /** Optional max raw value used for normalisation. Defaults to 1. */
  maxValue?: number;
}

// ---------------------------------------------------------------------------
// Custom objects
// ---------------------------------------------------------------------------

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'enum'
  | 'reference'
  | 'currency'
  | 'json';

export interface CustomField {
  key: string;
  label: string;
  type: CustomFieldType;
  required?: boolean;
  options?: string[];
  /** For `reference` fields — points to another CustomObject id. */
  referenceObject?: string;
  defaultValue?: unknown;
}

export interface CustomObject {
  id: string;
  name: string;
  pluralName: string;
  description?: string;
  fields: CustomField[];
  /** Optional list of allowed parent object ids (relationships). */
  relations?: string[];
  createdAt?: ISODateString;
}

// ---------------------------------------------------------------------------
// Quotes / Contracts / E-sign
// ---------------------------------------------------------------------------

export interface QuoteLineItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  taxPct?: number;
}

export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'revised';

export interface QuoteRedline {
  authorId: string;
  fieldPath: string;
  before: unknown;
  after: unknown;
  comment?: string;
  at: ISODateString;
}

export interface Quote {
  id: string;
  dealId?: string;
  number: string;
  version: number;
  /** Previous version id (if this quote is a revision). */
  previousVersionId?: string;
  customerId: string;
  status: QuoteStatus;
  currency: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  notes?: string;
  validUntil?: ISODateString;
  expiresAt?: ISODateString;
  redlines?: QuoteRedline[];
  createdAt: ISODateString;
  updatedAt?: ISODateString;
}

export type ContractStatus =
  | 'draft'
  | 'pending-review'
  | 'sent'
  | 'signed'
  | 'active'
  | 'expired'
  | 'terminated';

export interface ContractTemplate {
  id: string;
  name: string;
  /** Body containing `{{merge.field}}` placeholders. */
  body: string;
  /** Declared merge fields (for validation/UI). */
  mergeFields: string[];
  /** Default validity in days. */
  defaultTermDays?: number;
}

export interface Contract {
  id: string;
  templateId?: string;
  customerId: string;
  dealId?: string;
  title: string;
  body: string;
  status: ContractStatus;
  startDate?: ISODateString;
  endDate?: ISODateString;
  signedAt?: ISODateString;
  renewalReminderAt?: ISODateString;
  esignSessionId?: string;
  metadata?: Record<string, unknown>;
}

export type EsignSignerStatus =
  | 'pending'
  | 'viewed'
  | 'signed'
  | 'declined';

export interface EsignSigner {
  id: string;
  name: string;
  email: string;
  role?: string;
  order?: number;
  status: EsignSignerStatus;
  signature?: string;
  ip?: string;
  userAgent?: string;
  signedAt?: ISODateString;
}

export type EsignSessionStatus =
  | 'created'
  | 'in-progress'
  | 'completed'
  | 'expired'
  | 'cancelled';

export interface EsignAuditEntry {
  at: ISODateString;
  actor: string;
  event: string;
  detail?: string;
}

export interface EsignSession {
  id: string;
  documentUrl: string;
  documentHash?: string;
  signers: EsignSigner[];
  status: EsignSessionStatus;
  /** Signing order — `parallel` lets all sign at once, `sequential` enforces order. */
  flow: 'parallel' | 'sequential';
  audit: EsignAuditEntry[];
  sealedAt?: ISODateString;
  /** Hash of the signed bundle (placeholder — real PDF mutation deferred). */
  sealHash?: string;
  createdAt: ISODateString;
  expiresAt?: ISODateString;
}

// ---------------------------------------------------------------------------
// Sequences / Cadences / Playbooks
// ---------------------------------------------------------------------------

export type SequenceChannel = 'email' | 'sms' | 'whatsapp' | 'call' | 'task';

export interface SequenceStep {
  id: string;
  /** 1-indexed order in the sequence. */
  order: number;
  channel: SequenceChannel;
  /** Wait (in hours) after the previous step before executing. */
  delayHours: number;
  templateId?: string;
  subject?: string;
  body?: string;
  /** Branching: condition to evaluate against contact/deal. */
  condition?: SequenceCondition;
  onTrueNextStepId?: string;
  onFalseNextStepId?: string;
}

export interface SequenceCondition {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'exists';
  value?: unknown;
}

export interface Sequence {
  id: string;
  name: string;
  description?: string;
  steps: SequenceStep[];
  /** Auto-stop conditions (e.g. reply received). */
  stopOnReply?: boolean;
  stopOnMeetingBooked?: boolean;
  active: boolean;
  createdAt?: ISODateString;
}

export interface Cadence {
  id: string;
  name: string;
  /** Cadences group multiple sequences (e.g. New Inbound, Cold Outbound). */
  sequenceIds: string[];
  ownerId?: string;
  /** Touchpoints per day target. */
  dailyTouchTarget?: number;
  active: boolean;
}

export interface PlaybookStep {
  id: string;
  title: string;
  description?: string;
  /** Required action — done, skipped, or pending. */
  actionType: 'task' | 'email' | 'call' | 'meeting' | 'note' | 'custom';
  /** Conditions guarding this step. */
  enterWhen?: SequenceCondition[];
  /** Recommended next action(s). */
  next?: string[];
}

export interface Playbook {
  id: string;
  name: string;
  description?: string;
  /** Trigger event (e.g. `deal.created`, `stage.entered:Negotiation`). */
  trigger: string;
  steps: PlaybookStep[];
  /** Optional KPI targets. */
  kpis?: { name: string; target: number; unit?: string }[];
  active: boolean;
}

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------

export interface MeetingSlot {
  id: string;
  ownerId: string;
  start: ISODateString;
  end: ISODateString;
  /** Free / busy / tentative. */
  status: 'free' | 'busy' | 'tentative' | 'booked';
  /** When booked — attendee details. */
  attendeeEmail?: string;
  attendeeName?: string;
  meetingType?: string;
  location?: string;
  videoLink?: string;
}

// ---------------------------------------------------------------------------
// Win / Loss reasons
// ---------------------------------------------------------------------------

export interface WinLossReason {
  id: string;
  label: string;
  outcome: 'won' | 'lost';
  category?: string;
  /** Optional follow-up template id. */
  followUpTemplateId?: string;
}

// ---------------------------------------------------------------------------
// Lead routing
// ---------------------------------------------------------------------------

export interface Lead {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
  region?: string;
  source?: string;
  industry?: string;
  estimatedValue?: number;
  /** ISO timestamp the lead was received — used for SLA. */
  receivedAt?: ISODateString;
  /** Free-form attributes. */
  attributes?: Record<string, unknown>;
}

export interface SalesRep {
  id: string;
  name: string;
  email?: string;
  /** Higher weight = more leads when using `weighted`. */
  weight?: number;
  /** Country / region codes this rep covers. */
  territories?: string[];
  /** Industries this rep specialises in. */
  industries?: string[];
  /** Whether the rep is currently accepting new leads. */
  available?: boolean;
  /** Current open lead count — for SLA aware load balancing. */
  openLeads?: number;
  /** Maximum response time the rep guarantees (minutes). */
  slaMinutes?: number;
}

// ---------------------------------------------------------------------------
// Forecast / Health
// ---------------------------------------------------------------------------

export type ForecastMethod = 'best-case' | 'commit' | 'weighted';

export interface ForecastBreakdown {
  stageId: string;
  stageName: string;
  dealCount: number;
  totalAmount: number;
  weightedAmount: number;
}

export interface ForecastResult {
  method: ForecastMethod;
  currency: string;
  total: number;
  dealCount: number;
  breakdown: ForecastBreakdown[];
  computedAt: ISODateString;
}

export interface HealthSignal {
  /** Stable signal key — e.g. `usage`, `nps`, `support_tickets`. */
  key: string;
  value: number;
  /** Direction the metric should move for "good": higher or lower. */
  direction: 'higher-better' | 'lower-better';
  weight: number;
  /** Optional benchmark for normalisation. */
  benchmark?: number;
}

export interface HealthScore {
  customerId: string;
  /** 0-100. */
  score: number;
  status: 'healthy' | 'at-risk' | 'critical';
  signals: { key: string; weight: number; normalised: number; contribution: number }[];
  computedAt: ISODateString;
  recommendations: string[];
}
