/**
 * Create debit note — `/dashboard/crm/purchases/debit-notes/new`.
 *
 * Server component shell. The shared `<DebitNoteForm>` (also used by
 * Edit) handles all interactive bits. No custom fields — `'debitNote'`
 * is not in `WsCustomFieldBelongsTo`.
 */

import { FileMinus } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { DebitNoteForm } from '../_components/debit-note-form';

export const dynamic = 'force-dynamic';

export default async function NewDebitNotePage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New debit note"
        subtitle="Adjust a vendor bill downward for a return, discount, or short-shipment."
        icon={FileMinus}
      />
      <DebitNoteForm />
    </div>
  );
}
