'use client';

import React from 'react';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';
import { saveQuotation } from '@/app/actions/crm-quotations.actions';

export default function NewQuotationPage() {
    return (
        <LiveDocumentEditor
            documentType="quotation"
            saveAction={saveQuotation}
            backHref="/dashboard/crm/sales/quotations"
        />
    );
}
