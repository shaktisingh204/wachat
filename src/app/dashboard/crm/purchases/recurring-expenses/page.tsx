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
  const month = now + 30 * 86_400_000;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartTs = monthStart.getTime();

  let active = 0;
  let paused = 0;
  let dueNext7 = 0;
  let totalMonthlyValue = 0;
  let mtdSpend = 0;
  let expiringCount = 0;
  const vendorTotals = new Map<string, { amount: number; count: number }>();

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

      // MTD spend — booked once a schedule has fired this month.
      const lastRun = r.last_run_date ? new Date(r.last_run_date).getTime() : NaN;
      if (!Number.isNaN(lastRun) && lastRun >= monthStartTs) {
        mtdSpend += amt;
      }

      // Expiring within 30 days — either explicit until_date or the
      // remaining-runs counter has reached 1 of its cap.
      if (r.until_date) {
        const u = new Date(r.until_date).getTime();
        if (!Number.isNaN(u) && u >= now && u <= month) expiringCount += 1;
      } else if (
        typeof r.stop_at_count === 'number' &&
        r.stop_at_count > 0 &&
        typeof r.run_count === 'number' &&
        r.stop_at_count - r.run_count <= 1
      ) {
        expiringCount += 1;
      }

      const vendorKey = (r.vendor ?? '').trim();
      if (vendorKey) {
        const prev = vendorTotals.get(vendorKey) ?? { amount: 0, count: 0 };
        prev.amount += amt;
        prev.count += 1;
        vendorTotals.set(vendorKey, prev);
      }
    } else if (r.status === 'paused') {
      paused += 1;
    }
  }

  let topVendor: string | null = null;
  let topVendorAmount = 0;
  let topVendorCount = 0;
  for (const [v, agg] of vendorTotals) {
    if (agg.amount > topVendorAmount) {
      topVendor = v;
      topVendorAmount = agg.amount;
      topVendorCount = agg.count;
    }
  }

  return {
    active,
    paused,
    dueNext7,
    totalMonthlyValue,
    mtdSpend,
    expiringCount,
    topVendor,
    topVendorAmount,
    topVendorCount,
  };
}

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function RecurringExpensesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 25), 100);
  const q = (sp.q ?? '').trim();

  const docs = (await getRecurringExpenses()) as unknown as Array<
    WsRecurringExpense & { _id: unknown }
  >;
  // KPIs are derived from the whole window so totals don't shrink as the
  // user paginates. The list itself is sliced below.
  const allRows = (Array.isArray(docs) ? docs : []).map(toRow);
  const kpi = computeKpis(allRows);

  // Client-side pagination — the worksuite action doesn't yet expose a
  // page/limit cursor, so we hand the slice to the client and rely on
  // PaginationBar's URL writes for navigation.
  const start = (page - 1) * limit;
  const pageRows = allRows.slice(start, start + limit);
  const hasMore = start + limit < allRows.length;

  return (
    <EntityListShell
      title="Recurring Expenses"
      subtitle="Templates that auto-generate expense entries on a schedule."
    >
      <RecurringExpensesListClient
        rows={pageRows}
        kpi={kpi}
        defaultCurrency="INR"
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
      />
    </EntityListShell>
  );
}
