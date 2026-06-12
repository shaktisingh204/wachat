/**
 * SabSMS journeys — branch condition evaluation (pure).
 *
 * Conditions evaluate against the run's `vars` map (string → string).
 * `gt`/`lt` compare numerically when BOTH sides parse as finite numbers,
 * otherwise they fall back to lexicographic comparison. A missing var
 * evaluates as the empty string (so `ne`/`contains` behave sensibly).
 */

import type { JourneyCondition } from './types';

export function evaluateCondition(
  condition: JourneyCondition,
  vars: Record<string, string>,
): boolean {
  const raw = vars[condition.field];
  const left = raw === undefined || raw === null ? '' : String(raw);
  const right = condition.value;

  switch (condition.op) {
    case 'eq':
      return left === right;
    case 'ne':
      return left !== right;
    case 'contains':
      return right.length > 0 && left.toLowerCase().includes(right.toLowerCase());
    case 'gt':
    case 'lt': {
      const ln = Number(left);
      const rn = Number(right);
      const numeric =
        left.trim() !== '' && right.trim() !== '' && Number.isFinite(ln) && Number.isFinite(rn);
      if (numeric) return condition.op === 'gt' ? ln > rn : ln < rn;
      return condition.op === 'gt' ? left > right : left < right;
    }
  }
}
