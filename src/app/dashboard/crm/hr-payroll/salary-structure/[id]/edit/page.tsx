import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit salary structure page — wrap `<SalaryStructureForm initialData=… />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getSalaryStructureDoc } from '@/app/actions/crm-salary-structures.actions';

import { SalaryStructureForm } from '../../_components/salary-structure-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/hr-payroll/salary-structure';

export default async function EditSalaryStructurePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const doc = await getSalaryStructureDoc(id);
    if (!doc) notFound();

    const label = doc.employeeName ?? doc.employeeId ?? id;

    return (
        <EntityDetailShell
            title={`Edit · ${label}`}
            eyebrow="SALARY STRUCTURE"
            back={{ href: BASE, label: 'Salary structures' }}
        >
            <SalaryStructureForm initialData={doc} />
        </EntityDetailShell>
    );
}
