/**
 * SabCRM — win/loss outcome classification — PURE helpers.
 *
 * The structural twin of `./scoring.ts`: a `'server-only'`- and I/O-free module
 * so the unit tests (`tsx --test`) AND the `'use client'` settings page can
 * import the types + the deterministic classify/validate logic directly. The
 * Mongo / provisioning side effects live in `./win-loss.server.ts`, which
 * re-exports everything here.
 *
 * ## Model
 *
 * When a deal record changes stage, its NEW stage name resolves to an
 * {@link WinLossOutcome} (`'won' | 'lost' | 'open'`) by matching the configured
 * `wonStages` / `lostStages` lists (case-insensitive, trimmed). When that
 * outcome flips to a terminal state (`won` / `lost`) the UI / capture path may
 * require a structured reason — the rep must pick a value from the configured
 * `winReasonOptions` / `lossReasonOptions` (or supply any non-empty reason when
 * no option list is configured).
 *
 * ## Storage envelope (see `./win-loss.server.ts`)
 *
 * On a confirmed outcome change the outcome is written as plain scalars at
 * `data.outcome` (a SELECT: `won` / `lost`), `data.outcomeAt` (an ISO string)
 * and (when supplied) `data.winReason` / `data.lossReason` (SELECTs), with
 * capture metadata riding the reserved `data.__winloss` map — exactly the
 * AI-fields scalar envelope, so the records engine renders them with zero engine
 * change and no `updatedAt` bump.
 */

/** Terminal/open classification of a deal's current stage. */
export type WinLossOutcome = 'won' | 'lost' | 'open';

/** A single selectable win/loss reason (mirrors a SELECT FieldOption). */
export interface WinLossReasonOption {
  value: string;
  label: string;
  /** Token name from `--ui20-*` palette or a hex color. */
  color?: string;
}

/** The persisted per-project+object win/loss config (doc shape minus `_id`). */
export interface WinLossConfig {
  id: string;
  projectId: string;
  /** The object slug this config governs, e.g. `opportunities`. */
  objectSlug: string;
  /** Stage names (any of these) that classify a deal as WON. */
  wonStages: string[];
  /** Stage names (any of these) that classify a deal as LOST. */
  lostStages: string[];
  /** Whether a structured reason is required when a deal becomes WON. */
  requireWonReason: boolean;
  /** Whether a structured reason is required when a deal becomes LOST. */
  requireLostReason: boolean;
  /** Allowed win reasons (empty → any non-empty reason accepted). */
  winReasonOptions: WinLossReasonOption[];
  /** Allowed loss reasons (empty → any non-empty reason accepted). */
  lossReasonOptions: WinLossReasonOption[];
  createdAt: string;
  updatedAt: string;
}

/** Shape accepted by the save action (server stamps id / timestamps / project). */
export interface WinLossConfigInput {
  objectSlug: string;
  wonStages: string[];
  lostStages: string[];
  requireWonReason: boolean;
  requireLostReason: boolean;
  winReasonOptions: WinLossReasonOption[];
  lossReasonOptions: WinLossReasonOption[];
}

/** Just the fields {@link classifyOutcome} / {@link isReasonRequired} read. */
export type WinLossRules = Pick<
  WinLossConfig,
  | 'wonStages'
  | 'lostStages'
  | 'requireWonReason'
  | 'requireLostReason'
  | 'winReasonOptions'
  | 'lossReasonOptions'
>;

/** Result of validating a captured reason against the config. */
export interface ReasonValidation {
  ok: boolean;
  error?: string;
}

/** Default field keys the outcome scalars are written to. */
export const OUTCOME_FIELD = 'outcome';
export const OUTCOME_AT_FIELD = 'outcomeAt';
export const WIN_REASON_FIELD = 'winReason';
export const LOSS_REASON_FIELD = 'lossReason';

/** Reserved record-data namespace for the capture metadata. */
export const WINLOSS_META_KEY = '__winloss';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Case-insensitive, whitespace-trimmed view of a stage name. */
function norm(s: unknown): string {
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

/** True when `stage` (normalized) appears in `list` (normalized). */
function listHas(list: string[] | undefined, stage: string): boolean {
  if (!Array.isArray(list) || list.length === 0) return false;
  const target = norm(stage);
  if (!target) return false;
  return list.some((s) => norm(s) === target);
}

/* -------------------------------------------------------------------------- */
/* Classification                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Classify a stage name into an outcome. `wonStages` is checked first so a
 * stage listed (mis-configured) in BOTH lists resolves to `won`. Anything not
 * matched is `open`. Pure + deterministic.
 */
export function classifyOutcome(
  stageName: string | null | undefined,
  wonStages: string[],
  lostStages: string[],
): WinLossOutcome {
  const stage = norm(stageName);
  if (!stage) return 'open';
  if (listHas(wonStages, stage)) return 'won';
  if (listHas(lostStages, stage)) return 'lost';
  return 'open';
}

/**
 * Whether a structured reason is required for a given outcome under `config`.
 * Only the terminal outcomes (`won` / `lost`) can require a reason; `open`
 * never does.
 */
export function isReasonRequired(
  outcome: WinLossOutcome,
  config: Pick<WinLossRules, 'requireWonReason' | 'requireLostReason'>,
): boolean {
  if (outcome === 'won') return config.requireWonReason === true;
  if (outcome === 'lost') return config.requireLostReason === true;
  return false;
}

/**
 * Validate a captured reason for an outcome transition.
 *
 *  - `open` → always ok (no reason concept).
 *  - reason NOT required → ok (any reason, including empty, is accepted).
 *  - reason required + empty → error.
 *  - reason required + an option list configured + value not in the list →
 *    error (the rep must pick one of the allowed values).
 *  - otherwise → ok.
 *
 * Pure + deterministic; matching against the option list is case-insensitive on
 * the option `value`.
 */
export function validateOutcomeReason(
  outcome: WinLossOutcome,
  reason: string | null | undefined,
  config: WinLossRules,
): ReasonValidation {
  if (outcome === 'open') return { ok: true };

  const required = isReasonRequired(outcome, config);
  const trimmed = typeof reason === 'string' ? reason.trim() : '';

  if (!required) return { ok: true };

  if (!trimmed) {
    return {
      ok: false,
      error: `A ${outcome === 'won' ? 'win' : 'loss'} reason is required.`,
    };
  }

  const options =
    outcome === 'won' ? config.winReasonOptions : config.lossReasonOptions;
  if (Array.isArray(options) && options.length > 0) {
    const target = trimmed.toLowerCase();
    const match = options.some((o) => norm(o.value) === target);
    if (!match) {
      return {
        ok: false,
        error: `“${trimmed}” is not an allowed ${
          outcome === 'won' ? 'win' : 'loss'
        } reason.`,
      };
    }
  }

  return { ok: true };
}
