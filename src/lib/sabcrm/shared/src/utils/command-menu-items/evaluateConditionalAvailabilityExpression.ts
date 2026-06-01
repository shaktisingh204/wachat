import { type EvaluationContext } from 'expr-eval-fork';

import { conditionalAvailabilityParser } from '@/lib/sabcrm/shared/src/utils/command-menu-items/conditionalAvailabilityParser';

/**
 * Evaluates a conditional availability expression string against the given context.
 * Returns true when the expression is absent (no restriction) or evaluates to true.
 */
export const evaluateConditionalAvailabilityExpression = (
  expression: string | null | undefined,
  context: EvaluationContext,
): boolean => {
  const isNonEmptyString =
    typeof expression === 'string' && expression.length > 0;

  if (!isNonEmptyString) {
    return true;
  }

  try {
    const parsed = conditionalAvailabilityParser.parse(expression);

    return parsed.evaluate(context) === true;
  } catch {
    return false;
  }
};
