import { Button } from '@/components/zoruui';
import { ObjectId } from 'mongodb';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export const dynamic = 'force-dynamic';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import Link from 'next/link';

import { BudgetsListClient } from './_components/budgets-list-client';
import type { BudgetRow } from './_components/budgets-types';

type AnyBudget = {
  _id?: { toString(): string } | string;
  budgetHead?: string;
  headType?: string;
  period?: string;
  planAmount?: number;
  actual?: number;
  variance?: number;
  ownerId?: string;
  ownerName?: string;
  approverId?: string;
  approverName?: string;
  scenario?: string;
  status?: string;
};

function toId(v: AnyBudget['_id'], fallback: string): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'toString' in v) {
    try {
      return v.toString();
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export default async function BudgetsPage() {
  const session = await getSession();
  let budgets: BudgetRow[] = [];
  let loadError = false;

  if (session?.user?._id) {
    try {
      const { db } = await connectToDatabase();
      const userObjectId = new ObjectId(session.user._id as string);
      const docs = (await db
        .collection('crm_budgets')
        .find({ userId: userObjectId } as Record<string, unknown>)
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray()) as unknown as AnyBudget[];
      budgets = docs.map((b, idx) => ({
        _id: toId(b._id, String(idx)),
        budgetHead: b.budgetHead,
        headType: b.headType,
        period: b.period,
        planAmount:
          typeof b.planAmount === 'number' ? b.planAmount : undefined,
        actual: typeof b.actual === 'number' ? b.actual : undefined,
        variance: typeof b.variance === 'number' ? b.variance : undefined,
        ownerId: b.ownerId,
        ownerName: b.ownerName,
        approverId: b.approverId,
        approverName: b.approverName,
        scenario: b.scenario,
        status: b.status,
      }));
    } catch (e) {
      console.error('Failed to load crm_budgets:', e);
      loadError = true;
    }
  }

  return (
    <EntityListShell
      title="Budgets & Forecasting"
      subtitle="Track revenue and expense targets against actuals."
      primaryAction={
        <Link href="/dashboard/crm/budgets/new">
          <Button variant="outline" size="sm">
            New budget
          </Button>
        </Link>
      }
    >
      {loadError ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
          Could not load budgets.
        </div>
      ) : null}

      <BudgetsListClient budgets={budgets} />
    </EntityListShell>
  );
}
