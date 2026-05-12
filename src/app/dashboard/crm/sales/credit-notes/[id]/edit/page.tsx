/**
 * Edit credit note — `/dashboard/crm/sales/credit-notes/[id]/edit`.
 *
 * Hydrates the existing credit note and passes it to the shared
 * `<CreditNoteForm>` (re-used from the Create flow). The form submits a
 * PATCH because `_id` is rendered as a hidden input.
 */

import { notFound } from 'next/navigation';
import { FileMinus } from 'lucide-react';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { CreditNoteForm } from '../../_components/credit-note-form';
import { getCreditNote } from '@/app/actions/crm/credit-notes.actions';

export const dynamic = 'force-dynamic';

export default async function EditCreditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { creditNote } = await getCreditNote(id);

  if (!creditNote) notFound();

  const title = creditNote.cnNo || String(creditNote._id);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={`Edit ${title}`}
        subtitle="Update credit note details."
        icon={FileMinus}
      />
      <CreditNoteForm initial={creditNote} />
    </div>
  );
}
