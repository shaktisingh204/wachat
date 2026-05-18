/**
 * Edit bill — `/dashboard/crm/purchases/expenses/[id]/edit`.
 *
 * Hydrates the existing bill, fetches custom-field definitions, and
 * passes both to the shared `<BillForm>` (re-used from the Create
 * flow). The form submits a PATCH because `_id` is rendered as a
 * hidden input.
 */

import { notFound } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
    <EntityListShell title={`Edit ${title}`} subtitle="Update bill details.">
      <BillForm initial={bill} customFields={customFields} />
    </EntityListShell>
  );
}
