'use client';

import React from 'react';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';
import { saveLiveDocument } from '@/app/actions/crm-live-documents.actions';

export default function NewDocumentTemplatePage() {
    return (
        <LiveDocumentEditor
            documentType="document_template"
            saveAction={saveLiveDocument}
            backHref="/dashboard/hrm/hr/document-templates"
        />
    );
}
