/**
 * Bank Reconciliation — `/dashboard/crm/banking/reconciliation`
 *
 * Server component pre-fetches KPIs + reconciliation records and passes
 * them to `<ReconciliationListClient>` for the interactive matcher UI
 * and the saved-records table. The interactive "match book vs statement"
 * flow is preserved inside the client.
 */

import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Button } from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getCrmReconciliationKpis,
} from '@/app/actions/crm-reconciliation.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { ObjectId } from 'mongodb';
import { ReconciliationListClient } from './_components/reconciliation-list-client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/zoruui';

export const dynamic = 'force-dynamic';

async function listReconciliations() {
  const session = await getSession();
  if (!session?.user?._id) return [];
  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);
    const docs = await db
      .collection('crm_reconciliations')
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    return JSON.parse(JSON.stringify(docs)) as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}

async function BankReconciliationData() {
  const [kpis, records] = await Promise.all([
    getCrmReconciliationKpis(),
    listReconciliations(),
  ]);

  return <ReconciliationListClient kpis={kpis} records={records} />;
}

export default function BankReconciliationPage() {
  return (
    <EntityListShell
      title="Bank Reconciliation"
      subtitle="Match your bank statement transactions with your company's book entries."
      primaryAction={
        <Button asChild>
          <Link href="/dashboard/crm/banking/reconciliation/new">
            <Plus className="h-4 w-4" />
            New reconciliation
          </Link>
        </Button>
      }
    >
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <BankReconciliationData />
      </Suspense>
    </EntityListShell>
  );
}
