/**
 * IF executor — evaluates a condition and routes items to the
 * true branch (output index 0) or false branch (output index 1).
 *
 * Parameters:
 *   conditions  – {
 *     options?: { caseSensitive?: boolean; leftValue?: string }
 *     conditions?: [{ id, leftValue, operator: { type, operation }, rightValue }]
 *     combinator?: 'and' | 'or'   (default: 'and')
 *   }
 *
 * Supported operations (operator.operation):
 *   equals, notEquals, contains, notContains, startsWith, endsWith,
 *   regex, gt, gte, lt, lte, exists, notExists, true, false,
 *   empty, notEmpty
 */

import type { N8NNode, ExecutionContext, NodeExecutorResult } from '../types';
import { interpolateParameters } from '../helpers/interpolateVariables';

type Operator = {
  type?: string;
  operation: string;
};

type Condition = {
  id?: string;
  leftValue: unknown;
  operator: Operator;
  rightValue?: unknown;
};

function evaluateCondition(
  cond: Condition,
  caseSensitive: boolean
): boolean {
  const op = cond.operator.operation;
  let left = cond.leftValue;
  let right = cond.rightValue;

  // String normalisation
  const leftStr = String(left ?? '');
  const rightStr = String(right ?? '');
  const l = caseSensitive ? leftStr : leftStr.toLowerCase();
  const r = caseSensitive ? rightStr : rightStr.toLowerCase();

  switch (op) {
    case 'equals':
      return l === r;
    case 'notEquals':
      return l !== r;
    case 'contains':
      return l.includes(r);
    case 'notContains':
      return !l.includes(r);
    case 'startsWith':
      return l.startsWith(r);
    case 'endsWith':
      return l.endsWith(r);
    case 'regex': {
      try {
        const flags = caseSensitive ? '' : 'i';
        return new RegExp(rightStr, flags).test(leftStr);
      } catch {
        return false;
      }
    }
    case 'gt':
      return Number(left) > Number(right);
    case 'gte':
      return Number(left) >= Number(right);
    case 'lt':
      return Number(left) < Number(right);
    case 'lte':
      return Number(left) <= Number(right);
    case 'exists':
      return left !== undefined && left !== null;
    case 'notExists':
      return left === undefined || left === null;
    case 'true':
      return left === true || left === 'true' || left === 1;
    case 'false':
      return left === false || left === 'false' || left === 0;
    case 'empty':
      return (
        left === undefined ||
        left === null ||
        leftStr.trim() === '' ||
        (Array.isArray(left) && left.length === 0)
      );
    case 'notEmpty':
      return !(
        left === undefined ||
        left === null ||
        leftStr.trim() === '' ||
        (Array.isArray(left) && left.length === 0)
      );
    default:
      return false;
  }
}

export async function executeIf(
  node: N8NNode,
  inputItems: Record<string, unknown>[],
  context: ExecutionContext
): Promise<NodeExecutorResult> {
  const items = inputItems.length > 0 ? inputItems : [{}];
  const trueItems: Record<string, unknown>[] = [];
  const falseItems: Record<string, unknown>[] = [];

  for (let i = 0; i < items.length; i++) {
    const params = interpolateParameters(node.parameters, context, items, i);
    const condBlock = params.conditions as {
      options?: { caseSensitive?: boolean };
      conditions?: Condition[];
      combinator?: 'and' | 'or';
    } | undefined;

    const caseSensitive = condBlock?.options?.caseSensitive ?? true;
    const conditions: Condition[] = condBlock?.conditions ?? [];
    const combinator: 'and' | 'or' = condBlock?.combinator ?? 'and';

    let result: boolean;
    if (conditions.length === 0) {
      result = false;
    } else if (combinator === 'or') {
      result = conditions.some((c) => evaluateCondition(c, caseSensitive));
    } else {
      result = conditions.every((c) => evaluateCondition(c, caseSensitive));
    }

    if (result) {
      trueItems.push(items[i]);
    } else {
      falseItems.push(items[i]);
    }
  }

  return { items: trueItems, falseItems };
}
