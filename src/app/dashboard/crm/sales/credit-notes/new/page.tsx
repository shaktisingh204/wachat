/**
 * Create credit note — `/dashboard/crm/sales/credit-notes/new`.
 *
 * Server component shell. The shared `<CreditNoteForm>` (also used by
 * Edit) handles all interactive bits. No custom fields — `'creditNote'`
 * is not in `WsCustomFieldBelongsTo`.
 */

import { FileMinus } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { CreditNoteForm } from '../_components/credit-note-form';

export const dynamic = 'force-dynamic';

export default async function NewCreditNotePage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New credit note"
        subtitle="Refund or credit a customer against a prior invoice."
        icon={FileMinus}
      />
      <CreditNoteForm />
    </div>
  );
}
