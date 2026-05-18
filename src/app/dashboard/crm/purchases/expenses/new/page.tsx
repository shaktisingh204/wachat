/**
 * Create bill — `/dashboard/crm/purchases/expenses/new`.
 *
 * Server component: fetches the tenant's expense custom-field
 * definitions once, then hands off to the shared `<BillForm>` (also
 * used by Edit).
 *
 * Supports `?fromKind=purchaseOrder|grn|bill&fromId=` for cross-doc
 * pre-fill — the form reads those from the URL directly. `fromKind=bill`
 * is the Duplicate flow (clone an existing bill into a draft).
 *
 * NB: the `WsCustomFieldBelongsTo` key is `'expense'` — there is no
 * separate `'bill'` belongs-to value; bills and expenses share the
 * same custom-field schema.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { getBill } from '@/app/actions/crm/bills.actions';
import { BillForm } from '../_components/bill-form';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import type { CrmBillDoc } from '@/lib/rust-client/crm-bills';

export const dynamic = 'force-dynamic';

interface SearchParams {
  fromKind?: 'purchaseOrder' | 'grn' | 'bill';
  fromId?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

/**
 * Strip identity / audit / status from a source bill so the Duplicate
 * flow renders a clean draft instead of a copy that still looks "paid".
 */
function stripForDuplicate(doc: CrmBillDoc): CrmBillDoc {
  const clone: CrmBillDoc = { ...doc };
  delete (clone as Partial<CrmBillDoc>)._id;
  delete clone.audit;
  delete clone.identity;
  delete clone.assignment;
  delete clone.linkedPoId;
  delete clone.linkedGrnIds;
  delete clone.lineage;
  delete clone.createdAt;
  delete clone.updatedAt;
  delete clone.amountPaid;
  delete clone.balance;
  clone.status = 'draft';
  clone.billNo = undefined;
  return clone;
}

export default async function NewBillPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const fromKind = sp?.fromKind;
  const fromId = sp?.fromId;

  const customFields = (await getCustomFieldsFor('expense')) as WsCustomField[];

  let prefill: CrmBillDoc | null = null;
  if (fromKind === 'bill' && fromId) {
    try {
      const { bill } = await getBill(fromId);
      if (bill) prefill = stripForDuplicate(bill);
    } catch (e) {
      console.error('[new bill] duplicate prefill failed:', e);
    }
  }

  return (
    <EntityListShell title="New bill" subtitle="Record a vendor invoice or direct expense.">
      <BillForm initial={prefill} customFields={customFields} />
    </EntityListShell>
  );
}
