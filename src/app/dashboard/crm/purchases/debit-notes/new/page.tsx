import { Suspense } from 'react';
import { FileMinus } from 'lucide-react';
import { NewDebitNoteForm } from './new-note-form';
import { CrmPageHeader } from '../../../_components/crm-page-header';

export default async function NewDebitNotePage() {
    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto">
            <CrmPageHeader
                title="Create New Debit Note"
                subtitle="Record a vendor return or adjustment."
                icon={FileMinus}
            />
            <Suspense fallback={<div className="text-[13px] text-clay-ink-muted">Loading...</div>}>
                <NewDebitNoteForm />
            </Suspense>
        </div>
    );
}
