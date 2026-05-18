import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit OKR page — server wrapper that loads the OKR by id and passes it
 * as `initialData` to `<OkrForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getOkrById } from '@/app/actions/crm-okrs.actions';

import { OkrForm } from '../../_components/okr-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/okrs';

export default async function EditOkrPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: okrId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const okr = await getOkrById(okrId);
    if (!okr) notFound();

    return (
        <EntityListShell
            title={`Edit · ${okr.objective}`}
            subtitle="Update objective and key results. Changes are revalidated immediately."
        >
            <OkrForm initialData={okr} />
        </EntityListShell>
    );
}
