'use client';

import React from 'react';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';
import { saveLiveDocument } from '@/app/actions/crm-live-documents.actions';

export default function NewNoticePage() {
    return (
        <LiveDocumentEditor
            documentType="notice"
            saveAction={saveLiveDocument}
            backHref="/dashboard/hrm/hr/notices"
        />
    );
}
