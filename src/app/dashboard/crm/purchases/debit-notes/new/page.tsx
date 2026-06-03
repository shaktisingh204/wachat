/**
 * Create debit note — `/dashboard/crm/purchases/debit-notes/new`.
 *
 * Server component: renders the canonical `<DebitNoteForm>` (backed by
 * `saveDebitNote` → `crmDebitNotesApi.create`), the same typed store the
 * Debit Notes list reads from. Previously this page used the generic
 * `LiveDocumentEditor`, which persisted to the unrelated `live_documents`
 * collection so created debit notes never appeared in the list.
 */

import { DebitNoteForm } from '../_components/debit-note-form-v2';

export const dynamic = 'force-dynamic';

export default function NewDebitNotePage() {
    return <DebitNoteForm />;
}
