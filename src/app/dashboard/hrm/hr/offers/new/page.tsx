'use client';

import React from 'react';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';
import { saveLiveDocument } from '@/app/actions/crm-live-documents.actions';

export default function NewOfferPage() {
    return (
        <LiveDocumentEditor
            documentType="offer_letter"
            saveAction={saveLiveDocument}
            backHref="/dashboard/hrm/hr/offers"
        />
    );
}
