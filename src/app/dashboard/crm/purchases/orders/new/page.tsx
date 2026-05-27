'use client';

import React from 'react';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';
import { saveLiveDocument } from '@/app/actions/crm-live-documents.actions';

export default function NewPurchaseOrderPage() {
    return (
        <LiveDocumentEditor
            documentType="purchase_order"
            saveAction={saveLiveDocument}
            backHref="/dashboard/crm/purchases/orders"
        />
    );
}
