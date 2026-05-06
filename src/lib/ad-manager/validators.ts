/**
 * Ad-manager input validation — neutralised.
 *
 * The legacy zod schemas in this file used to validate every payload
 * before it reached `graph.facebook.com`. With the migration to the
 * Rust BFF (see `rust/crates/ad-manager`), validation now happens
 * server-side: Rust forwards the body to Graph, and Graph rejects
 * malformed input with a typed error message that propagates back
 * through the `{ data?, error? }` envelope. Maintaining a parallel
 * zod copy on the Next.js side was duplicative and drift-prone.
 *
 * Rather than touch the ~20 `validate(...)` call sites in
 * `ad-manager.actions.ts`, this module keeps the surface intact: every
 * schema name remains exported (as an inert sentinel) and `validate`
 * is now a passthrough that always returns `{ data: input }`. The
 * sentinel is never inspected — the Rust + Graph layer is the source
 * of truth for input shape and value rules.
 */

export type ActionResult<T = unknown> = { data?: T; error?: string };

export type ValidationError = {
    error: string;
    issues?: Array<{ path: string; message: string }>;
};

/**
 * Passthrough validator. Returns `{ data: input }` regardless of the
 * supplied schema. The return type still includes a `ValidationError`
 * union so existing call sites that branch on `'error' in result`
 * continue to type-check.
 */
export function validate<T>(_schema: unknown, input: T): { data: T } | ValidationError {
    return { data: input };
}

// Sentinel — every schema export below is a reference to this constant.
// Name-only imports stay valid at compile time; the value is never read.
const SCHEMA_PLACEHOLDER = Object.freeze({}) as unknown;

// ── Primitives ─────────────────────────────────────────────────────
export const IdString = SCHEMA_PLACEHOLDER;
export const AdAccountId = SCHEMA_PLACEHOLDER;
export const GraphNodeId = SCHEMA_PLACEHOLDER;
export const NonEmptyString = (_name: string, _max = 512) => SCHEMA_PLACEHOLDER;
export const OptionalString = (_max = 512) => SCHEMA_PLACEHOLDER;
export const UrlString = SCHEMA_PLACEHOLDER;
export const PositiveInt = (_name: string) => SCHEMA_PLACEHOLDER;
export const NonNegativeInt = SCHEMA_PLACEHOLDER;
export const CurrencyMinorUnits = SCHEMA_PLACEHOLDER;
export const IsoDate = SCHEMA_PLACEHOLDER;
export const IsoDateTime = SCHEMA_PLACEHOLDER;
export const CountryCode = SCHEMA_PLACEHOLDER;
export const Currency = SCHEMA_PLACEHOLDER;
export const FbId = SCHEMA_PLACEHOLDER;
export const PixelId = SCHEMA_PLACEHOLDER;
export const PageId = SCHEMA_PLACEHOLDER;
export const BusinessId = SCHEMA_PLACEHOLDER;

// ── Enums ──────────────────────────────────────────────────────────
export const CampaignObjective = SCHEMA_PLACEHOLDER;
export const CampaignStatus = SCHEMA_PLACEHOLDER;
export const BuyingType = SCHEMA_PLACEHOLDER;
export const BidStrategy = SCHEMA_PLACEHOLDER;
export const SpecialAdCategory = SCHEMA_PLACEHOLDER;
export const BillingEvent = SCHEMA_PLACEHOLDER;
export const OptimizationGoal = SCHEMA_PLACEHOLDER;
export const EffectiveStatus = SCHEMA_PLACEHOLDER;
export const CallToActionType = SCHEMA_PLACEHOLDER;
export const DatePreset = SCHEMA_PLACEHOLDER;
export const InsightsLevel = SCHEMA_PLACEHOLDER;
export const CustomAudienceSubtype = SCHEMA_PLACEHOLDER;
export const CustomerFileSource = SCHEMA_PLACEHOLDER;

// ── Composite schemas ──────────────────────────────────────────────
export const TargetingSchema = SCHEMA_PLACEHOLDER;
export const PromotedObjectSchema = SCHEMA_PLACEHOLDER;
export const ObjectStorySpecSchema = SCHEMA_PLACEHOLDER;
export const CreateCampaignInput = SCHEMA_PLACEHOLDER;
export const CreateAdSetInput = SCHEMA_PLACEHOLDER;
export const CreateAdInput = SCHEMA_PLACEHOLDER;
export const CreateCreativeInput = SCHEMA_PLACEHOLDER;
export const CreateCustomAudienceInput = SCHEMA_PLACEHOLDER;
export const CreateLookalikeInput = SCHEMA_PLACEHOLDER;
export const InsightsQueryInput = SCHEMA_PLACEHOLDER;
export const ReachEstimateInput = SCHEMA_PLACEHOLDER;
export const DeliveryEstimateInput = SCHEMA_PLACEHOLDER;
export const CustomConversionInput = SCHEMA_PLACEHOLDER;
export const ConversionApiEventInput = SCHEMA_PLACEHOLDER;
export const AdRuleInput = SCHEMA_PLACEHOLDER;
export const LeadGenFormInput = SCHEMA_PLACEHOLDER;

/**
 * Friendly error mapper — kept as a passthrough since the Rust side
 * already extracts `error.message` from the Graph envelope and
 * surfaces it as a string. Retained for any rare external caller.
 */
export function friendlyGraphError(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    if (err && typeof err === 'object' && 'message' in (err as any)) {
        return String((err as any).message);
    }
    return 'An unexpected error occurred.';
}
