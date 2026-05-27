'use client';

import React from 'react';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';
import { saveLiveDocument } from '@/app/actions/crm-live-documents.actions';

export default function NewTravelPage() {
    return (
        <LiveDocumentEditor
            documentType="travel_request"
            saveAction={saveLiveDocument}
            backHref="/dashboard/hrm/hr/travel"
        />
    );
}
