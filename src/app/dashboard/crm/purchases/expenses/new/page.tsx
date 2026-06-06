/**
 * Create bill — `/dashboard/crm/purchases/expenses/new`.
 *
 * Server component: fetches the tenant's expense custom-field definitions,
 * then renders the canonical `<BillForm>` (backed by `saveBillAction`).
 */

import * as React from 'react';
import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { PageHeader, ZoruWaterLoader } from '@/components/sabcrm/20ui/compat';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

import { BillForm } from '../_components/bill-form';

export const dynamic = 'force-dynamic';

export default async function NewBillPage() {
  const customFields = (await getCustomFieldsFor('expense').catch(() => [])) as WsCustomField[];

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title="New bill"
        subtitle="Record a vendor invoice or direct expense"
        icon={Receipt}
        breadcrumb={
          <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
            <Link
              href="/dashboard/crm/purchases/expenses"
              className="transition-colors hover:text-[var(--st-text)]"
            >
              Bills &amp; Expenses
            </Link>
            <span>/</span>
            <span className="font-medium text-[var(--st-text)]">New</span>
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
          <BillForm customFields={customFields} />
        </React.Suspense>
      </main>
    </div>
  );
}
