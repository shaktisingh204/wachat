/**
 * Edit bill — `/dashboard/crm/purchases/expenses/[id]/edit`.
 *
 * Hydrates the existing bill, fetches custom-field definitions, and
 * passes both to the shared `<BillForm>` (re-used from the Create
 * flow). The form submits a PATCH because `_id` is rendered as a
 * hidden input.
 */

import { notFound } from 'next/navigation';
import { Wallet } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { BillForm } from '../../_components/bill-form';
import { getBill } from '@/app/actions/crm/bills.actions';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function EditBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ bill }, customFields] = await Promise.all([
    getBill(id),
    getCustomFieldsFor('expense') as Promise<WsCustomField[]>,
  ]);

  if (!bill) notFound();

  const title = bill.billNo || bill.vendorInvoiceNo || 'Bill';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${title}`}
        subtitle="Update bill details."
        icon={Wallet}
        breadcrumbs={[
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Purchases', href: '/dashboard/crm/purchases' },
          { label: 'Bills', href: '/dashboard/crm/purchases/expenses' },
          { label: title, href: `/dashboard/crm/purchases/expenses/${id}` },
          { label: 'Edit' },
        ]}
      />
      <BillForm initial={bill} customFields={customFields} />
    </div>
  );
}
