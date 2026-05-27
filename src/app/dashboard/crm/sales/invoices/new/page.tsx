'use client';

import React from 'react';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';
import { saveInvoice } from '@/app/actions/crm-invoices.actions';

export default function NewInvoicePage() {
    return (
        <LiveDocumentEditor
            documentType="invoice"
            saveAction={saveInvoice}
            backHref="/dashboard/crm/sales/invoices"
        />
    );
}
