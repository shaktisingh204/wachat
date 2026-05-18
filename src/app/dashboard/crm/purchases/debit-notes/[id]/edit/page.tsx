/**
 * Edit debit note — `/dashboard/crm/purchases/debit-notes/[id]/edit`.
 *
 * Hydrates the existing debit note and passes it to the shared
 * `<DebitNoteForm>` (re-used from the Create flow). The form submits a
 * PATCH because `_id` is rendered as a hidden input.
 */

import { notFound } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { DebitNoteForm } from '../../_components/debit-note-form';
import { getDebitNote } from '@/app/actions/crm/debit-notes.actions';

export const dynamic = 'force-dynamic';

export default async function EditDebitNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { debitNote } = await getDebitNote(id);

  if (!debitNote) notFound();

  const title = debitNote.dnNo || String(debitNote._id);

  return (
    <EntityListShell title={`Edit ${title}`} subtitle="Update debit note details.">
      <DebitNoteForm initial={debitNote} />
    </EntityListShell>
  );
}
