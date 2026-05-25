import { Suspense } from 'react';
import { redirect } from 'next/navigation';

/**
 * New document page — server wrapper around `<DocumentForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';

import { DocumentForm } from '../_components/document-form';

export const dynamic = 'force-dynamic';

async function NewDocumentPageContainer() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New Document"
            subtitle="Track a new HR document — contracts, IDs, certifications and more."
        >
            <DocumentForm />
        </EntityListShell>
    );
}

export default function NewDocumentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewDocumentPageContainer  />
    </Suspense>
  );
}
