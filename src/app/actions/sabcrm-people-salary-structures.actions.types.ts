/**
 * SabCRM People — Salary Structures action types (client-safe).
 *
 * Shared vocabulary between
 * `sabcrm-people-salary-structures.actions.ts` and the
 * `/sabcrm/people/salary-structures` surface (rich shape per WI-8).
 * No server imports.
 */

import type {
  SabcrmApplicability,
  SabcrmCalcKind,
  SabcrmComponentFrequency,
  SabcrmSalaryComponent,
  SabcrmSalaryComponentType,
  SabcrmSalaryStructureDoc,
} from '@/lib/rust-client/sabcrm-people-salary-structures';
import type { DocStatusDef } from '@/app/sabcrm/finance/_components/doc-surface/types';

export type {
  SabcrmApplicability,
  SabcrmCalcKind,
  SabcrmComponentFrequency,
  SabcrmSalaryComponent,
  SabcrmSalaryComponentType,
  SabcrmSalaryStructureDoc,
};

/* ─── Status vocabulary (synthesized from the `active` flag) ────── */

export const SALARY_STRUCTURE_STATUSES: DocStatusDef[] = [
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'inactive', label: 'Inactive', tone: 'neutral' },
];

export const COMPONENT_TYPES: {
  value: SabcrmSalaryComponentType;
  label: string;
}[] = [
  { value: 'earning', label: 'Earning' },
  { value: 'deduction', label: 'Deduction' },
  { value: 'reimbursement', label: 'Reimbursement' },
];

export const CALC_KINDS: { value: SabcrmCalcKind['kind']; label: string }[] = [
  { value: 'fixed', label: 'Fixed amount' },
  { value: 'percent_basic', label: '% of basic' },
  { value: 'percent_ctc', label: '% of CTC' },
  { value: 'formula', label: 'Formula' },
];

export const COMPONENT_FREQUENCIES: {
  value: SabcrmComponentFrequency;
  label: string;
}[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

export const APPLICABILITY_KINDS: {
  value: SabcrmApplicability['kind'];
  label: string;
}[] = [
  { value: 'employee', label: 'Employee' },
  { value: 'department', label: 'Department' },
  { value: 'grade', label: 'Grade / band' },
];

/* ─── List ──────────────────────────────────────────────────────── */

export interface SabcrmSalaryStructureListFilters {
  page: number;
  q?: string;
  /** 'active' | 'inactive' | '' (maps to the engine `active` flag). */
  status: string;
}

export interface SabcrmSalaryStructureListRow {
  id: string;
  name: string;
  effectiveDate: string;
  componentCount: number;
  earningCount: number;
  deductionCount: number;
  reimbursementCount: number;
  /** "2 employees · 1 department · L4" summary, labels resolved. */
  applicabilitySummary: string;
  active: boolean;
  /** 'active' | 'inactive' for the status cell. */
  status: string;
}

export interface SabcrmSalaryStructureListPage {
  rows: SabcrmSalaryStructureListRow[];
  hasMore: boolean;
}

/* ─── Form input (full rich field set) ──────────────────────────── */

export interface SabcrmSalaryStructureInput {
  name: string;
  /** `YYYY-MM-DD`. */
  effectiveDate: string;
  components: SabcrmSalaryComponent[];
  applicableTo: SabcrmApplicability[];
  active: boolean;
}

/** Edit-drawer seed: the rich doc + resolved applicableTo labels. */
export interface SabcrmSalaryStructureView {
  doc: SabcrmSalaryStructureDoc;
  /** id → label for employee/department applicability targets. */
  targetLabels: Record<string, string>;
}

/* ─── Client-side calc preview (display only — server is truth) ─── */

/**
 * Tiny client-side mirror of the engine's `resolve_amount` for the
 * form's live example preview. Supports the four calc kinds plus
 * `min(a,b)` / `max(a,b)` in formulas via a safe regex-checked
 * evaluation over the `basic|ctc|monthlyCtc|annualCtc` identifiers.
 * NEVER persisted — the engine recomputes authoritative numbers.
 */
export function previewComponentAmount(
  component: SabcrmSalaryComponent,
  basic: number,
  monthlyCtc: number,
): number | null {
  const cap = (n: number): number => {
    let v = n;
    if (component.maxCap != null) v = Math.min(v, component.maxCap);
    if (component.minCap != null) v = Math.max(v, component.minCap);
    return v;
  };
  const calc = component.calc;
  switch (calc.kind) {
    case 'fixed':
      return cap(calc.amount);
    case 'percent_basic':
      return cap((basic * calc.pct) / 100);
    case 'percent_ctc':
      return cap((monthlyCtc * calc.pct) / 100);
    case 'formula': {
      const normalized = calc.expr
        .replace(/\bBASIC\b/gi, String(basic))
        .replace(/\bmonthlyCtc\b/gi, String(monthlyCtc))
        .replace(/\bannualCtc\b/gi, String(monthlyCtc * 12))
        .replace(/\bCTC\b/gi, String(monthlyCtc))
        .replace(/\bmin\b/gi, 'Math.min')
        .replace(/\bmax\b/gi, 'Math.max');
      // Only digits, operators, parens, dots, commas and Math.min/max.
      if (!/^[\d\s+\-*/().,]+$/.test(normalized.replace(/Math\.(min|max)/g, ''))) {
        return null;
      }
      try {
        // eslint-disable-next-line no-new-func -- sanitised arithmetic only
        const out = new Function(`return (${normalized});`)();
        return typeof out === 'number' && Number.isFinite(out) ? cap(out) : null;
      } catch {
        return null;
      }
    }
    default:
      return null;
  }
}
