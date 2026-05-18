/**
 * Recurring Expenses list — `/dashboard/crm/purchases/recurring-expenses`.
 *
 * Server component. Hydrates Mongo-backed schedules via
 * `getRecurringExpenses`, computes the KPI strip, then hands off to
 * `<RecurringExpensesListClient>` (KPI + filters + bulk bar + table).
 *
 * Per CRM_REBUILD_PLAN §1D — thin slice (list + new + detail; edit /
 * activity sub-routes deferred to a follow-up pass).
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getRecurringExpenses } from '@/app/actions/worksuite/billing.actions';
import type { WsRecurringExpense } from '@/lib/worksuite/billing-types';

import { RecurringExpensesListClient } from './_components/recurring-expenses-list-client';
import type {
  RecurringExpenseKpiSnapshot,
  RecurringExpenseRow,
} from './_components/types';

export const dynamic = 'force-dynamic';

function toRow(doc: WsRecurringExpense & { _id: unknown }): RecurringExpenseRow {
  return {
    _id: String(doc._id),
    name: doc.name ?? '',
    amount: typeof doc.amount === 'number' ? doc.amount : 0,
    currency: doc.currency ?? 'INR',
    vendor: doc.vendor,
    category_name: doc.category_name,
    frequency: doc.frequency,
    frequency_count: doc.frequency_count ?? 1,
    status: doc.status,
    start_date: doc.start_date ? new Date(doc.start_date).toISOString() : undefined,
    next_run_date: doc.next_run_date
      ? new Date(doc.next_run_date).toISOString()
      : undefined,
    last_run_date: doc.last_run_date
      ? new Date(doc.last_run_date).toISOString()
      : undefined,
    until_date: doc.until_date ? new Date(doc.until_date).toISOString() : undefined,
    stop_at_count: doc.stop_at_count,
    run_count: doc.run_count ?? 0,
    payment_method: doc.payment_method,
    notes: doc.notes,
    generated_expense_ids: Array.isArray(doc.generated_expense_ids)
      ? doc.generated_expense_ids.map((g) => String(g))
      : undefined,
  };
}

/**
 * Project a list of schedules into the KPI strip:
 *   - active: count of `status === 'active'`
 *   - paused: count of `status === 'paused'`
 *   - dueNext7: number of active schedules with `next_run_date` in the
 *     next 7 days (inclusive of today).
 *   - totalMonthlyValue: sum of each active schedule's amount normalized
 *     to a calendar month (daily * 30, weekly * 4.33, yearly / 12).
 */
function computeKpis(rows: RecurringExpenseRow[]): RecurringExpenseKpiSnapshot {
  const now = Date.now();
  const week = now + 7 * 86_400_000;
  let active = 0;
  let paused = 0;
  let dueNext7 = 0;
  let totalMonthlyValue = 0;

  for (const r of rows) {
    if (r.status === 'active') {
      active += 1;
      if (r.next_run_date) {
        const t = new Date(r.next_run_date).getTime();
        if (!Number.isNaN(t) && t >= now && t <= week) dueNext7 += 1;
      }
      const amt = Number(r.amount) || 0;
      const count = Number(r.frequency_count) || 1;
      let perMonth = 0;
      switch (r.frequency) {
        case 'days':
          perMonth = (amt / count) * 30;
          break;
        case 'weeks':
          perMonth = (amt / count) * (30 / 7);
          break;
        case 'months':
          perMonth = amt / count;
          break;
        case 'years':
          perMonth = amt / (count * 12);
          break;
      }
      totalMonthlyValue += perMonth;
    } else if (r.status === 'paused') {
      paused += 1;
    }
  }
  return { active, paused, dueNext7, totalMonthlyValue };
}

export default async function RecurringExpensesPage() {
  const docs = (await getRecurringExpenses()) as unknown as Array<
    WsRecurringExpense & { _id: unknown }
  >;
  const rows = (Array.isArray(docs) ? docs : []).map(toRow);
  const kpi = computeKpis(rows);

  return (
    <EntityListShell
      title="Recurring Expenses"
      subtitle="Templates that auto-generate expense entries on a schedule."
    >
      <RecurringExpensesListClient
        rows={rows}
        kpi={kpi}
        defaultCurrency="INR"
      />
    </EntityListShell>
  );
}
