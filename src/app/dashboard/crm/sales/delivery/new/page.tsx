'use client';

import React from 'react';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';
import { saveDeliveryChallan } from '@/app/actions/crm-delivery-challans.actions';

export default function NewDeliveryChallanPage() {
    return (
        <LiveDocumentEditor
            documentType="delivery"
            saveAction={saveDeliveryChallan}
            backHref="/dashboard/crm/sales/delivery"
        />
    );
}
