import { substituteVariables } from './substituteVariables';
import type { ConditionOptions, ConditionGroup, Comparison as FlowComparison } from '@/lib/sabflow/types';

// ── Engine-internal operator type (snake_case, used by engine.Condition) ──────

export type ComparisonOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'matches_regex';

export type LogicalOperator = 'and' | 'or';

/** Engine-internal comparison shape (uses snake_case operator + variableName key). */
export type Comparison = {
  variableName: string;
  operator: ComparisonOperator;
  value?: string;
};

/** Engine-internal condition shape (flat comparisons list). */
export type Condition = {
  comparisons: Comparison[];
  logicalOperator?: LogicalOperator;
};

// ── UI label → engine operator mapping ────────────────────────────────────────

const LABEL_TO_OPERATOR: Record<string, ComparisonOperator> = {
  'Equal to':                'equals',
  'Not equal to':            'not_equals',
  'Contains':                'contains',
  'Does not contain':        'not_contains',
  'Starts with':             'starts_with',
  'Ends with':               'ends_with',
  'Greater than':            'greater_than',
  'Less than':               'less_than',
  'Greater than or equal':   'greater_or_equal',
  'Less than or equal':      'less_or_equal',
  'Is empty':                'is_empty',
  'Is not empty':            'is_not_empty',
  'Matches regex':           'matches_regex',
};

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Evaluates a structured condition against the current variable map.
 *
 * Accepts two shapes:
 *   1. The engine-internal `Condition` (flat comparisons, snake_case operators, variableName keys)
 *   2. The UI-level `ConditionOptions` (conditionGroups, human-readable operator labels, variableId keys)
 *
 * Returns true if the condition passes, false otherwise.
 */
export function evaluateCondition(
  condition: Condition | ConditionOptions,
  variables: Record<string, string>,
): boolean {
  // Detect UI-level ConditionOptions shape
  if ('conditionGroups' in condition) {
    return evaluateConditionOptions(condition, variables);
  }

  // Engine-internal flat Condition shape
  return evaluateFlatCondition(condition, variables);
}

// ── ConditionOptions (UI shape) evaluator ─────────────────────────────────────

function evaluateConditionOptions(
  opts: ConditionOptions,
  variables: Record<string, string>,
): boolean {
  const { conditionGroups, logicalOperator } = opts;
  if (!conditionGroups || conditionGroups.length === 0) return false;

  const groupResults = conditionGroups.map((group) =>
    evaluateConditionGroup(group, variables),
  );

  return logicalOperator === 'OR'
    ? groupResults.some(Boolean)
    : groupResults.every(Boolean);
}

function evaluateConditionGroup(
  group: ConditionGroup,
  variables: Record<string, string>,
): boolean {
  const { comparisons, logicalOperator } = group;
  if (!comparisons || comparisons.length === 0) return false;

  const results = comparisons.map((c) =>
    evaluateFlowComparison(c, variables),
  );

  return logicalOperator === 'OR'
    ? results.some(Boolean)
    : results.every(Boolean);
}

function evaluateFlowComparison(
  comparison: FlowComparison,
  variables: Record<string, string>,
): boolean {
  if (!comparison.variableId || !comparison.operator) return false;

  // Resolve variable by id — try id first, then fall back to name key
  const rawInput = variables[comparison.variableId] ?? null;

  const engineOp = LABEL_TO_OPERATOR[comparison.operator];
  if (!engineOp) return false;

  const rawValue =
    comparison.value !== undefined
      ? substituteVariables(comparison.value, variables)
      : null;

  return runComparison(engineOp, rawInput, rawValue, variables);
}

// ── Flat Condition (engine shape) evaluator ───────────────────────────────────

function evaluateFlatCondition(
  condition: Condition,
  variables: Record<string, string>,
): boolean {
  const { comparisons, logicalOperator = 'and' } = condition;
  if (!comparisons || comparisons.length === 0) return false;

  const results = comparisons.map((c) => evaluateSingleComparison(c, variables));
  return logicalOperator === 'and'
    ? results.every(Boolean)
    : results.some(Boolean);
}

function evaluateSingleComparison(
  comparison: Comparison,
  variables: Record<string, string>,
): boolean {
  const rawInput = variables[comparison.variableName] ?? null;
  const rawValue =
    comparison.value !== undefined
      ? substituteVariables(comparison.value, variables)
      : null;

  return runComparison(comparison.operator, rawInput, rawValue, variables);
}

// ── Core comparison dispatcher ─────────────────────────────────────────────────

function runComparison(
  operator: ComparisonOperator,
  rawInput: string | null,
  rawValue: string | null,
  _variables: Record<string, string>,
): boolean {
  switch (operator) {
    case 'equals':
      return normalise(rawInput) === normalise(rawValue);

    case 'not_equals':
      return normalise(rawInput) !== normalise(rawValue);

    case 'contains':
      if (!rawInput || !rawValue) return false;
      return rawInput.toLowerCase().trim().includes(rawValue.toLowerCase().trim());

    case 'not_contains':
      if (!rawInput || !rawValue) return true;
      return !rawInput.toLowerCase().trim().includes(rawValue.toLowerCase().trim());

    case 'starts_with':
      if (!rawInput || !rawValue) return false;
      return rawInput.toLowerCase().trim().startsWith(rawValue.toLowerCase().trim());

    case 'ends_with':
      if (!rawInput || !rawValue) return false;
      return rawInput.toLowerCase().trim().endsWith(rawValue.toLowerCase().trim());

    case 'greater_than':
      if (rawInput === null || rawValue === null) return false;
      return toComparable(rawInput) > toComparable(rawValue);

    case 'less_than':
      if (rawInput === null || rawValue === null) return false;
      return toComparable(rawInput) < toComparable(rawValue);

    case 'greater_or_equal':
      if (rawInput === null || rawValue === null) return false;
      return toComparable(rawInput) >= toComparable(rawValue);

    case 'less_or_equal':
      if (rawInput === null || rawValue === null) return false;
      return toComparable(rawInput) <= toComparable(rawValue);

    case 'is_empty':
      return rawInput === null || rawInput.trim() === '';

    case 'is_not_empty':
      return rawInput !== null && rawInput.trim() !== '';

    case 'matches_regex': {
      if (!rawInput || !rawValue) return false;
      try {
        // Support /pattern/flags syntax as well as plain patterns
        const regexMatch = rawValue.match(/^\/(.+)\/([gimsuy]*)$/);
        const regex = regexMatch
          ? new RegExp(regexMatch[1], regexMatch[2])
          : new RegExp(rawValue);
        return regex.test(rawInput);
      } catch {
        return false;
      }
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Case-insensitive, normalised string equality helper. */
function normalise(value: string | null): string {
  return (value ?? '').toLowerCase().trim().normalize();
}

/**
 * Parses a string as a number, date timestamp, or falls back to string length
 * so that numeric/date comparisons work intuitively.
 */
function toComparable(value: string): number {
  const num = value.startsWith('+') ? NaN : Number(value);
  if (!Number.isNaN(num)) return num;
  const time = Date.parse(value);
  if (!Number.isNaN(time)) return time;
  return value.length;
}
