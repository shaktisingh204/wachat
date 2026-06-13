/**
 * SabCRM — record validation rules — PURE evaluator.
 *
 * The data-quality sibling of `./scoring.ts`: a `'server-only'`- and I/O-free
 * module so the unit tests and the `'use client'` settings editor can import
 * the types + the deterministic check directly. The Mongo persistence +
 * write-time enforcement live in `./data-quality.server.ts`.
 *
 * ## Model
 *
 * A {@link ValidationRule} reuses the records-engine {@link FilterCondition}
 * vocabulary, but with inverted intent: **the condition describes the
 * VIOLATION** — when it matches a record, the rule fires. So "Amount must be
 * > 0" is the condition `{ field: 'amount', op: 'lte', value: 0 }`, and a
 * required field is `{ field: 'email', op: 'isEmpty' }`. This is the cleanest
 * reuse of `evalCondition` (no inversion logic at runtime).
 *
 * A `block` rule rejects the save (the create/update action returns an error);
 * a `warn` rule is advisory (surfaced but the save proceeds).
 */

import type { FilterCondition } from './records-filter';
import { evalCondition } from './scoring';

/** Whether a fired rule blocks the save or is merely advisory. */
export type ValidationSeverity = 'block' | 'warn';

/** One validation rule. Fires (a violation) when `condition` matches. */
export interface ValidationRule {
  id: string;
  label?: string;
  /** The VIOLATION condition (reuses the records filter vocabulary). */
  condition: FilterCondition;
  severity: ValidationSeverity;
  /** Shown to the user when the rule fires, e.g. "Email is required". */
  message: string;
  /** Disabled rules are skipped. Absent = enabled. */
  enabled?: boolean;
}

/** A persisted set of validation rules scoped to one object. */
export interface ValidationRuleSet {
  id: string;
  projectId: string;
  objectSlug: string;
  name: string;
  enabled: boolean;
  rules: ValidationRule[];
  createdAt: string;
  updatedAt: string;
}

/** Save-action input (server stamps id / timestamps / project). */
export interface ValidationRuleSetInput {
  id?: string;
  objectSlug: string;
  name: string;
  enabled: boolean;
  rules: ValidationRule[];
}

/** One fired rule. */
export interface ValidationViolation {
  ruleId: string;
  message: string;
}

/** Outcome of validating a record's data against a rule set. */
export interface ValidationResult {
  /** False when ANY `block` rule fired. */
  ok: boolean;
  blocked: ValidationViolation[];
  warnings: ValidationViolation[];
}

/**
 * Evaluate a record's data against one rule set. A rule fires when its
 * (violation) condition matches; `block` rules collect into `blocked` (and
 * flip `ok`), `warn` rules into `warnings`. Pure + deterministic.
 */
export function evaluateValidation(
  ruleSet: Pick<ValidationRuleSet, 'rules'>,
  data: Record<string, unknown>,
): ValidationResult {
  const blocked: ValidationViolation[] = [];
  const warnings: ValidationViolation[] = [];
  for (const rule of ruleSet.rules ?? []) {
    if (rule.enabled === false || !rule.condition) continue;
    if (evalCondition(data, rule.condition)) {
      const v: ValidationViolation = {
        ruleId: rule.id,
        message: rule.message || rule.label || 'Validation failed.',
      };
      if (rule.severity === 'block') blocked.push(v);
      else warnings.push(v);
    }
  }
  return { ok: blocked.length === 0, blocked, warnings };
}

/** Merge results from several rule sets into one. */
export function mergeValidationResults(
  results: ValidationResult[],
): ValidationResult {
  const blocked = results.flatMap((r) => r.blocked);
  const warnings = results.flatMap((r) => r.warnings);
  return { ok: blocked.length === 0, blocked, warnings };
}
