/**
 * Switch executor — routes items to named branches based on a value match.
 *
 * Parameters:
 *   mode            – 'rules' | 'expression' (default: 'rules')
 *
 *   [mode: rules]
 *   dataType        – 'string' | 'number' | 'boolean' (default: 'string')
 *   value1          – the value to test (left-hand side, supports interpolation)
 *   rules           – {
 *     rules: [{ operation, value2, output }]
 *   }
 *   fallbackOutput  – output index for non-matching items (default: last output)
 *
 *   [mode: expression]
 *   output          – expression that resolves to the branch index / name
 *
 * The result's `branches` map is keyed by string branch name (usually
 * the stringified output index).  The executor also populates `items`
 * with all items that matched output 0 for compatibility.
 */

import type { N8NNode, ExecutionContext, NodeExecutorResult } from '../types';
import { interpolateParameters } from '../helpers/interpolateVariables';

type Rule = {
  operation: string;
  value2: unknown;
  /** Which output branch index this rule maps to */
  output: number;
};

function matchRule(left: unknown, op: string, right: unknown): boolean {
  const l = String(left ?? '').toLowerCase();
  const r = String(right ?? '').toLowerCase();
  switch (op) {
    case 'equal':
    case 'equals':
      return l === r;
    case 'notEqual':
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
    case 'larger':
    case 'gt':
      return Number(left) > Number(right);
    case 'largerEqual':
    case 'gte':
      return Number(left) >= Number(right);
    case 'smaller':
    case 'lt':
      return Number(left) < Number(right);
    case 'smallerEqual':
    case 'lte':
      return Number(left) <= Number(right);
    case 'regex': {
      try {
        return new RegExp(String(right ?? '')).test(String(left ?? ''));
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

export async function executeSwitch(
  node: N8NNode,
  inputItems: Record<string, unknown>[],
  context: ExecutionContext
): Promise<NodeExecutorResult> {
  const items = inputItems.length > 0 ? inputItems : [{}];

  // Collect branches as a map: branchKey -> items[]
  const branchMap: Map<string, Record<string, unknown>[]> = new Map();

  const addToBranch = (key: string, item: Record<string, unknown>) => {
    const existing = branchMap.get(key) ?? [];
    existing.push(item);
    branchMap.set(key, existing);
  };

  for (let i = 0; i < items.length; i++) {
    const params = interpolateParameters(node.parameters, context, items, i);
    const mode = (params.mode as string) ?? 'rules';

    if (mode === 'expression') {
      const output = String(params.output ?? '0');
      addToBranch(output, items[i]);
      continue;
    }

    // rules mode
    const value1 = params.value1;
    const rulesBlock = params.rules as { rules?: Rule[] } | Rule[] | undefined;
    const rules: Rule[] = Array.isArray(rulesBlock)
      ? rulesBlock
      : (rulesBlock?.rules ?? []);

    let matched = false;
    for (const rule of rules) {
      if (matchRule(value1, rule.operation, rule.value2)) {
        addToBranch(String(rule.output ?? 0), items[i]);
        matched = true;
        // n8n switch by default falls through to first match only
        break;
      }
    }

    if (!matched) {
      const fallback = String(params.fallbackOutput ?? rules.length);
      addToBranch(fallback, items[i]);
    }
  }

  // Convert map to plain object
  const branches: Record<string, Record<string, unknown>[]> = {};
  for (const [key, val] of branchMap) {
    branches[key] = val;
  }

  return {
    // `items` = branch "0" for compatibility with single-output consumers
    items: branches['0'] ?? [],
    branches,
  };
}
