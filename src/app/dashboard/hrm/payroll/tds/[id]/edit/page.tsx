import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit TDS record page — server wrapper that loads the record and passes
 * it as `initialData` to `<TdsForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getTdsRecordById } from '@/app/actions/crm-tds.actions';

import { TdsForm } from '../../_components/tds-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/tds';

export default async function EditTdsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const row = await getTdsRecordById(id);
    if (!row) notFound();

    const employeeName = (row.employeeName as string | undefined) ?? 'TDS record';
    const financialYear = (row.financialYear as string | undefined) ?? '—';
    const quarter = (row.quarter as string | undefined) ?? '—';

    return (
        <EntityListShell
            title={`Edit · ${employeeName}`}
            subtitle={`FY ${financialYear} · ${quarter}`}
        >
            <TdsForm initialData={row} />
        </EntityListShell>
    );
}
