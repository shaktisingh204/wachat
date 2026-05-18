import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit PF/ESI record page — server wrapper.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getPfEsiRecordById } from '@/app/actions/crm-pf-esi.actions';

import { PfEsiForm } from '../../_components/pf-esi-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/pf-esi';

export default async function EditPfEsiPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const row = await getPfEsiRecordById(id);
    if (!row) notFound();

    const employeeName = (row.employeeName as string | undefined) ?? 'PF/ESI record';
    const month = (row.month as string | undefined) ?? '—';

    return (
        <EntityListShell
            title={`Edit · ${employeeName}`}
            subtitle={month}
        >
            <PfEsiForm initialData={row} />
        </EntityListShell>
    );
}
