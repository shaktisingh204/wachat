/**
 * Edit bill — `/dashboard/crm/purchases/expenses/[id]/edit`.
 *
 * Server component: loads the bill via `getBill` (reads from `crmBillsApi`
 * / the Rust BFF) and the tenant's expense custom-field schema, then
 * renders the canonical `<BillForm>` in edit mode (same form used by
 * New, backed by `saveBillAction`).
 */

import { notFound, redirect } from 'next/navigation';
import * as React from 'react';
import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { PageHeader, ZoruWaterLoader } from '@/components/zoruui';

import { getSession } from '@/app/actions/user.actions';
import { getBill } from '@/app/actions/crm/bills.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

import { BillForm } from '../../_components/bill-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/purchases/expenses';

export default async function EditBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) redirect('/login');

  const [{ bill, error }, customFields] = await Promise.all([
    getBill(id),
    getCustomFieldsFor('expense').catch(() => []) as Promise<WsCustomField[]>,
  ]);

  if (!bill) {
    if (error) notFound();
    notFound();
  }

  const billNo = bill.billNo ?? id.slice(-6);

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title={`Edit bill ${billNo}`}
        subtitle="Update vendor invoice details"
        icon={Receipt}
        breadcrumb={
          <div className="flex items-center gap-2 text-sm text-zoru-ink-muted">
            <Link
              href={BASE}
              className="transition-colors hover:text-zoru-ink"
            >
              Bills &amp; Expenses
            </Link>
            <span>/</span>
            <Link
              href={`${BASE}/${id}`}
              className="transition-colors hover:text-zoru-ink"
            >
              {billNo}
            </Link>
            <span>/</span>
            <span className="font-medium text-zoru-ink">Edit</span>
          </div>
        }
      />

      <main className="min-w-0 flex-1 space-y-6">
        <React.Suspense
          fallback={
            <div className="flex justify-center p-12">
              <ZoruWaterLoader />
            </div>
          }
        >
          <BillForm
            initial={bill}
            customFields={customFields}
            redirectTo={`${BASE}/${id}`}
          />
        </React.Suspense>
      </main>
    </div>
  );
}
