'use client';

import React from 'react';
import { LiveDocumentEditor } from '@/components/crm/live-editor/live-document-editor';
import { saveProposal } from '@/app/actions/crm-proposals.actions';

export default function NewProposalPage() {
    return (
        <LiveDocumentEditor
            documentType="proposal"
            saveAction={saveProposal}
            backHref="/dashboard/crm/sales/proposals"
        />
    );
}
