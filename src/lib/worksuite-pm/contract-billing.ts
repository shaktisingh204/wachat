/**
 * Contract billing — fixed-fee, time-and-materials, and retainer
 * invoice generation.
 *
 * `generateInvoice(contract, period)` returns a draft invoice (line
 * items + totals). Persistence and PDF rendering are handled by the
 * caller — this module is pure.
 */
import type {
  ContractBilling,
  ID,
  Milestone,
  TimeEntry,
} from './types';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit?: 'hours' | 'flat' | 'percent';
  unitPrice: number;
  amount: number;
  meta?: Record<string, unknown>;
}

export interface DraftInvoice {
  contractId: ID;
  projectId: ID;
  clientId: ID;
  userId: ID;
  currency: string;
  model: ContractBilling['model'];
  periodStart: string;
  periodEnd: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  total: number;
  notes?: string;
}

export interface BillingPeriod {
  start: string;
  end: string;
}

export interface GenerateInvoiceInputs {
  contract: ContractBilling;
  period: BillingPeriod;
  /** Time entries for the project — only billable ones in-period are billed. */
  timeEntries?: TimeEntry[];
  /** Milestones (used for fixed-fee progress billing). */
  milestones?: Milestone[];
  /** Default hourly rate fallback for T&M when neither contract nor entry sets one. */
  fallbackHourlyRate?: number;
}

export function generateInvoice(inputs: GenerateInvoiceInputs): DraftInvoice {
  const { contract, period } = inputs;
  validatePeriod(period);

  const base: Omit<DraftInvoice, 'lineItems' | 'subtotal' | 'total'> = {
    contractId: contract.id,
    projectId: contract.projectId,
    clientId: contract.clientId,
    userId: contract.userId,
    currency: contract.currency,
    model: contract.model,
    periodStart: period.start,
    periodEnd: period.end,
  };

  let lines: InvoiceLineItem[] = [];
  switch (contract.model) {
    case 'fixed_fee':
      lines = fixedFeeLines(contract, period, inputs.milestones ?? []);
      break;
    case 'time_and_materials':
      lines = tmLines(
        contract,
        period,
        inputs.timeEntries ?? [],
        inputs.fallbackHourlyRate,
      );
      break;
    case 'retainer':
      lines = retainerLines(
        contract,
        period,
        inputs.timeEntries ?? [],
        inputs.fallbackHourlyRate,
      );
      break;
  }

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  return {
    ...base,
    lineItems: lines,
    subtotal: round2(subtotal),
    total: round2(subtotal),
  };
}

/* ─────────── per-model line builders ─────────── */

function fixedFeeLines(
  contract: ContractBilling,
  period: BillingPeriod,
  milestones: Milestone[],
): InvoiceLineItem[] {
  const lines: InvoiceLineItem[] = [];
  const fee = contract.fixedFee ?? 0;
  const rules = contract.scheduleRules ?? [];
  if (!rules.length) {
    // Whole fee on the period that contains the contract start.
    if (
      withinPeriod(contract.startDate, period) ||
      withinPeriod(period.start, {
        start: contract.startDate,
        end: contract.endDate ?? period.end,
      })
    ) {
      lines.push({
        description: `Fixed fee — ${nameFor(contract)}`,
        quantity: 1,
        unit: 'flat',
        unitPrice: fee,
        amount: fee,
      });
    }
    return lines;
  }

  for (const rule of rules) {
    const amount =
      rule.amount ??
      (rule.percent != null ? (rule.percent / 100) * fee : 0);
    if (rule.trigger === 'milestone' && rule.milestoneId) {
      const ms = milestones.find((m) => m.id === rule.milestoneId);
      if (ms?.completed && withinPeriod(ms.dueDate, period)) {
        lines.push({
          description:
            rule.description ?? `Milestone payment — ${ms.name}`,
          quantity: 1,
          unit: 'flat',
          unitPrice: amount,
          amount,
        });
      }
    } else if (rule.trigger === 'date' && rule.date) {
      if (withinPeriod(rule.date, period)) {
        lines.push({
          description: rule.description ?? 'Scheduled payment',
          quantity: 1,
          unit: 'flat',
          unitPrice: amount,
          amount,
        });
      }
    } else if (rule.trigger === 'recurring' && rule.everyDays && rule.everyDays > 0) {
      // Count number of cycle anchors that fall within the period.
      const anchors = recurringAnchors(
        contract.startDate,
        rule.everyDays,
        period,
        contract.endDate,
      );
      for (const a of anchors) {
        lines.push({
          description: rule.description ?? 'Recurring payment',
          quantity: 1,
          unit: 'flat',
          unitPrice: amount,
          amount,
          meta: { anchor: a },
        });
      }
    }
  }
  return lines;
}

function tmLines(
  contract: ContractBilling,
  period: BillingPeriod,
  timeEntries: TimeEntry[],
  fallbackRate?: number,
): InvoiceLineItem[] {
  const billable = filterBillableInPeriod(timeEntries, period).filter(
    (e) => e.projectId === contract.projectId,
  );
  // Group by hourly rate (so different rates appear on separate lines).
  const groups = new Map<number, { hours: number; count: number }>();
  for (const e of billable) {
    const rate = e.hourlyRate ?? contract.hourlyRate ?? fallbackRate ?? 0;
    const hours = (e.durationMinutes ?? 0) / 60;
    const g = groups.get(rate) ?? { hours: 0, count: 0 };
    g.hours += hours;
    g.count += 1;
    groups.set(rate, g);
  }
  const lines: InvoiceLineItem[] = [];
  for (const [rate, g] of groups) {
    if (g.hours <= 0) continue;
    const hours = round2(g.hours);
    lines.push({
      description: `Time & materials — ${hours} hrs @ ${rate}/hr`,
      quantity: hours,
      unit: 'hours',
      unitPrice: rate,
      amount: round2(hours * rate),
      meta: { entries: g.count },
    });
  }
  return lines;
}

function retainerLines(
  contract: ContractBilling,
  period: BillingPeriod,
  timeEntries: TimeEntry[],
  fallbackRate?: number,
): InvoiceLineItem[] {
  const lines: InvoiceLineItem[] = [];
  const amount = contract.retainerAmount ?? 0;
  lines.push({
    description: `Retainer (${contract.retainerCadence ?? 'monthly'})`,
    quantity: 1,
    unit: 'flat',
    unitPrice: amount,
    amount,
  });

  const cap = contract.retainerCapHours;
  if (cap && cap > 0) {
    const billable = filterBillableInPeriod(timeEntries, period).filter(
      (e) => e.projectId === contract.projectId,
    );
    const totalHours = billable.reduce(
      (s, e) => s + (e.durationMinutes ?? 0) / 60,
      0,
    );
    if (totalHours > cap) {
      const overage = totalHours - cap;
      const rate = contract.hourlyRate ?? fallbackRate ?? 0;
      lines.push({
        description: `Retainer overage — ${round2(overage)} hrs @ ${rate}/hr`,
        quantity: round2(overage),
        unit: 'hours',
        unitPrice: rate,
        amount: round2(overage * rate),
      });
    }
  }
  return lines;
}

/* ─────────── helpers ─────────── */

function nameFor(c: ContractBilling): string {
  return `Contract ${c.id}`;
}

function validatePeriod(p: BillingPeriod): void {
  const a = Date.parse(p.start);
  const b = Date.parse(p.end);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) {
    throw new Error('Invalid billing period');
  }
}

function withinPeriod(iso: string, p: BillingPeriod): boolean {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return t >= Date.parse(p.start) && t < Date.parse(p.end);
}

function filterBillableInPeriod(
  entries: TimeEntry[],
  p: BillingPeriod,
): TimeEntry[] {
  return entries.filter((e) => {
    if (!e.billable) return false;
    if (!e.endedAt) return false;
    return withinPeriod(e.endedAt, p);
  });
}

function recurringAnchors(
  start: string,
  everyDays: number,
  period: BillingPeriod,
  end?: string,
): string[] {
  const out: string[] = [];
  const startMs = Date.parse(start);
  const endMs = end ? Date.parse(end) : Number.POSITIVE_INFINITY;
  const periodStart = Date.parse(period.start);
  const periodEnd = Date.parse(period.end);
  const step = everyDays * 24 * 60 * 60 * 1000;
  for (let t = startMs; t <= endMs && t < periodEnd; t += step) {
    if (t >= periodStart) out.push(new Date(t).toISOString());
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
