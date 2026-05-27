'use client';

import React from 'react';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';
import { saveLiveDocument } from '@/app/actions/crm-live-documents.actions';

export default function NewContractPage() {
    return (
        <LiveDocumentEditor
            documentType="contract"
            saveAction={saveLiveDocument}
            backHref="/dashboard/crm/contracts"
        />
    );
}
