import { redirect } from 'next/navigation';

/**
 * New document page — server wrapper around `<DocumentForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { DocumentForm } from '../_components/document-form';

export const dynamic = 'force-dynamic';

export default async function NewDocumentPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            title="New Document"
            eyebrow="DOCUMENT"
            back={{ href: '/dashboard/crm/hr/documents', label: 'Documents' }}
        >
            <DocumentForm />
        </EntityDetailShell>
    );
}
