import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit Professional Tax record page — server wrapper.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getProfessionalTaxRecordById } from '@/app/actions/crm-professional-tax.actions';

import { ProfessionalTaxForm } from '../../_components/professional-tax-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/professional-tax';

export default async function EditProfessionalTaxPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const row = await getProfessionalTaxRecordById(id);
    if (!row) notFound();

    const employeeName =
        (row.employeeName as string | undefined) ?? 'PT record';
    const month = (row.month as string | undefined) ?? '—';

    return (
        <EntityListShell
            title={`Edit · ${employeeName}`}
            subtitle={month}
        >
            <ProfessionalTaxForm initialData={row} />
        </EntityListShell>
    );
}
