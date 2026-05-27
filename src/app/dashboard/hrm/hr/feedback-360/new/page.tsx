'use client';

import React from 'react';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';
import { saveLiveDocument } from '@/app/actions/crm-live-documents.actions';

export default function NewFeedback360Page() {
    return (
        <LiveDocumentEditor
            documentType="feedback_360"
            saveAction={saveLiveDocument}
            backHref="/dashboard/hrm/hr/feedback-360"
        />
    );
}
