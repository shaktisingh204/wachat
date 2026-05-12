/**
 * Create bill — `/dashboard/crm/purchases/expenses/new`.
 *
 * Server component: fetches the tenant's expense custom-field
 * definitions once, then hands off to the shared `<BillForm>` (also
 * used by Edit).
 *
 * NB: the `WsCustomFieldBelongsTo` key is `'expense'` — there is no
 * separate `'bill'` belongs-to value; bills and expenses share the
 * same custom-field schema.
 */

import { Wallet } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { BillForm } from '../_components/bill-form';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function NewBillPage() {
  const customFields = (await getCustomFieldsFor('expense')) as WsCustomField[];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New bill"
        subtitle="Record a vendor invoice or direct expense."
        icon={Wallet}
      />
      <BillForm customFields={customFields} />
    </div>
  );
}
