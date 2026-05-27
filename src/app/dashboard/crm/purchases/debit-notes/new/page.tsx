'use client';

import React from 'react';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';
import { saveLiveDocument } from '@/app/actions/crm-live-documents.actions';

export default function NewDebitNotePage() {
    return (
        <LiveDocumentEditor
            documentType="debit_note"
            saveAction={saveLiveDocument}
            backHref="/dashboard/crm/purchases/debit-notes"
        />
    );
}
