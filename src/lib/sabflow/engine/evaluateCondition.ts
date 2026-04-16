import { substituteVariables } from './substituteVariables';

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

export type Comparison = {
  variableName: string;
  operator: ComparisonOperator;
  value?: string;
};

export type Condition = {
  comparisons: Comparison[];
  logicalOperator?: LogicalOperator;
};

/**
 * Evaluates a structured condition against the current variable map.
 * Returns true if the condition passes, false otherwise.
 */
export function evaluateCondition(
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

  switch (comparison.operator) {
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

    case 'greater_than': {
      if (rawInput === null || rawValue === null) return false;
      return toComparable(rawInput) > toComparable(rawValue);
    }

    case 'less_than': {
      if (rawInput === null || rawValue === null) return false;
      return toComparable(rawInput) < toComparable(rawValue);
    }

    case 'greater_or_equal': {
      if (rawInput === null || rawValue === null) return false;
      return toComparable(rawInput) >= toComparable(rawValue);
    }

    case 'less_or_equal': {
      if (rawInput === null || rawValue === null) return false;
      return toComparable(rawInput) <= toComparable(rawValue);
    }

    case 'is_empty':
      return rawInput === null || rawInput === '';

    case 'is_not_empty':
      return rawInput !== null && rawInput !== '';

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
