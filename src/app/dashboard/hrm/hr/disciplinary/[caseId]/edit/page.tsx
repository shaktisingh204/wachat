import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit disciplinary case page — server wrapper that loads the case by
 * id and passes it as `initialData` to `<DisciplinaryForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getDisciplinaryCaseById } from '@/app/actions/crm-disciplinary.actions';

import { DisciplinaryForm } from '../../_components/disciplinary-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/disciplinary';

export default async function EditDisciplinaryCasePage({
    params,
}: {
    params: Promise<{ caseId: string }>;
}) {
    const { caseId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const caseDoc = await getDisciplinaryCaseById(caseId);
    if (!caseDoc) notFound();

    const employeeRef =
        caseDoc.employeeName || caseDoc.employeeId || `Case ${caseId.slice(-8)}`;

    return (
        <EntityListShell
            title={`Edit · ${employeeRef}`}
            subtitle="Update case details, evidence and hearings."
        >
            <DisciplinaryForm initialData={caseDoc} />
        </EntityListShell>
    );
}
