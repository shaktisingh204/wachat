import { redirect } from 'next/navigation';
import { Suspense } from 'react';

/**
 * New TDS record page — server wrapper.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { NewTdsClient } from './page-client';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

export const dynamic = 'force-dynamic';

export default async function NewTdsPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New TDS record"
            subtitle="Record TDS for an employee for a specific FY + quarter."
        >
            <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
                <NewTdsClient />
            </Suspense>
        </EntityListShell>
    );
}
