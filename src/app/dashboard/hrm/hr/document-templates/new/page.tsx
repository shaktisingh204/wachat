import { redirect } from 'next/navigation';

/**
 * New document template page — server wrapper around `<DocumentTemplateForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';

import { DocumentTemplateForm } from '../_components/document-template-form';

export const dynamic = 'force-dynamic';

export default async function NewDocumentTemplatePage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New Document Template"
            subtitle="Author a reusable HR document template with placeholder variables."
        >
            <DocumentTemplateForm />
        </EntityListShell>
    );
}
