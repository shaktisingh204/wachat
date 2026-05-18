import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit Form 16 page — server wrapper that loads the record and passes it
 * as `initialData` to `<Form16Form />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getForm16ById } from '@/app/actions/crm-form-16.actions';

import { Form16Form } from '../../_components/form-16-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/form-16';

export default async function EditForm16Page({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const row = await getForm16ById(id);
    if (!row) notFound();

    const employeeName = (row.employeeName as string | undefined) ?? 'Form 16';
    const financialYear = (row.financialYear as string | undefined) ?? '—';

    return (
        <EntityListShell
            title={`Edit · ${employeeName}`}
            subtitle={`Update Form 16 for FY ${financialYear}.`}
        >
            <Form16Form initialData={row} />
        </EntityListShell>
    );
}
