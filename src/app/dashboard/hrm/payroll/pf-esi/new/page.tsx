import { redirect } from 'next/navigation';

/**
 * New PF/ESI record page — server wrapper around `<PfEsiForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';

import { PfEsiForm } from '../_components/pf-esi-form';
import { PfEsiBulkImport } from '../_components/pf-esi-bulk-import';

export const dynamic = 'force-dynamic';

export default async function NewPfEsiPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New PF/ESI record"
            subtitle="Record an employee's monthly PF + ESI contributions and challan."
        >
            <PfEsiBulkImport />
            <div className="mb-4 text-sm font-medium text-zoru-ink/70">Or create a record manually:</div>
            <PfEsiForm />
        </EntityListShell>
    );
}
