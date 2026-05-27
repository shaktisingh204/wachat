'use client';

import React from 'react';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';
import { saveProformaInvoice } from '@/app/actions/crm-proforma-invoices.actions';

export default function NewProformaPage() {
    return (
        <LiveDocumentEditor
            documentType="proforma"
            saveAction={saveProformaInvoice}
            backHref="/dashboard/crm/sales/proforma"
        />
    );
}
