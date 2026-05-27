'use client';

import React from 'react';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';
import { saveSalesOrder } from '@/app/actions/crm-sales-orders.actions';

export default function NewSalesOrderPage() {
    return (
        <LiveDocumentEditor
            documentType="order"
            saveAction={saveSalesOrder}
            backHref="/dashboard/crm/sales/orders"
        />
    );
}
