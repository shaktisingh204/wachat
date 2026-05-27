'use client';

import React from 'react';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';
import { saveLiveDocument } from '@/app/actions/crm-live-documents.actions';

export default function NewServiceContractPage() {
    return (
        <LiveDocumentEditor
            documentType="service_contract"
            saveAction={saveLiveDocument}
            backHref="/dashboard/crm/service-contracts"
        />
    );
}
