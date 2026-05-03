/**
 * Project profitability calculations.
 *
 * Inputs are deliberately *plain data* so the function can be called
 * from a server action that has just queried Mongo, or from a test
 * with hand-rolled fixtures.
 *
 * Definitions
 * ───────────
 *   revenue    = sum of issued invoice amounts (or accrual estimates)
 *   cost       = labour cost + expenses
 *   margin     = (revenue - cost) / revenue   (0 when revenue == 0)
 *   budgetUsed = cost / budget                (null when no budget)
 *   burnRate   = cost / elapsed-weeks         (null when 0 elapsed)
 */
import type { ID, Project, TimeEntry } from './types';

export interface ProfitabilityInputs {
  project: Project;
  timeEntries: TimeEntry[];
  /** Per-member loaded cost rate ($/hr). Falls back to `defaultCostRate`. */
  memberCostRates?: Record<ID, number>;
  defaultCostRate?: number;
  /** Total invoiced revenue for the project to date. */
  invoicedAmount?: number;
  /** Optional non-labour expenses. */
  expenses?: number;
  /** Reference date for elapsed-weeks; defaults to now. */
  asOf?: string;
}

export interface ProfitabilityResult {
  projectId: ID;
  revenue: number;
  cost: number;
  laborCost: number;
  expenses: number;
  margin: number;
  budgetUsedPct: number | null;
  /** Weekly burn (cost per week since project start). */
  burnRate: number | null;
  hoursLogged: number;
  hoursBillable: number;
  currency?: string;
}

export function projectProfitability(
  inputs: ProfitabilityInputs,
): ProfitabilityResult {
  const {
    project,
    timeEntries,
    memberCostRates = {},
    defaultCostRate = 0,
    invoicedAmount = 0,
    expenses = 0,
    asOf,
  } = inputs;

  let laborCost = 0;
  let hoursLogged = 0;
  let hoursBillable = 0;
  for (const e of timeEntries) {
    if (e.projectId !== project.id) continue;
    const hours = (e.durationMinutes ?? 0) / 60;
    hoursLogged += hours;
    if (e.billable) hoursBillable += hours;
    const rate = memberCostRates[e.memberId] ?? defaultCostRate;
    laborCost += hours * rate;
  }

  const cost = laborCost + expenses;
  const revenue = invoicedAmount;
  const margin = revenue > 0 ? (revenue - cost) / revenue : 0;
  const budgetUsedPct =
    project.budget && project.budget > 0 ? (cost / project.budget) * 100 : null;

  const burnRate = computeBurnRate(project.startDate, asOf, cost);

  return {
    projectId: project.id,
    revenue: round2(revenue),
    cost: round2(cost),
    laborCost: round2(laborCost),
    expenses: round2(expenses),
    margin: Math.round(margin * 10000) / 10000,
    budgetUsedPct: budgetUsedPct == null ? null : round2(budgetUsedPct),
    burnRate: burnRate == null ? null : round2(burnRate),
    hoursLogged: round2(hoursLogged),
    hoursBillable: round2(hoursBillable),
    currency: project.currency,
  };
}

function computeBurnRate(
  startDate: string | undefined,
  asOf: string | undefined,
  cost: number,
): number | null {
  if (!startDate) return null;
  const start = Date.parse(startDate);
  const now = asOf ? Date.parse(asOf) : Date.now();
  if (Number.isNaN(start) || Number.isNaN(now) || now <= start) return null;
  const weeks = (now - start) / (1000 * 60 * 60 * 24 * 7);
  if (weeks <= 0) return null;
  return cost / weeks;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
