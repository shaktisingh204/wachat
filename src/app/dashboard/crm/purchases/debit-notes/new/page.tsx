'use server';

import { Suspense } from 'react';
import { NewDebitNoteForm } from './new-note-form';

export default async function NewDebitNotePage() {
    return (
        <div className="max-w-5xl mx-auto py-6">
            <h1 className="text-2xl font-bold mb-6">Create New Debit Note</h1>
            <Suspense fallback={<div>Loading...</div>}>
                <NewDebitNoteForm />
            </Suspense>
        </div>
    );
}
