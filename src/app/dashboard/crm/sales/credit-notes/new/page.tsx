'use client';

import React from 'react';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';
import { saveCreditNote } from '@/app/actions/crm-credit-notes.actions';

export default function NewCreditNotePage() {
    return (
        <LiveDocumentEditor
            documentType="credit_note"
            saveAction={saveCreditNote}
            backHref="/dashboard/crm/sales/credit-notes"
        />
    );
}
