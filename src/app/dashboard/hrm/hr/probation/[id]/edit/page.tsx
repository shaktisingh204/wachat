import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit probation page — server wrapper that loads the probation by id
 * and passes it as `initialData` to `<ProbationForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';
import { getCrmProbationById } from '@/app/actions/crm-probation.actions';

import { ProbationForm } from '../../_components/probation-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/probation';

export default async function EditProbationPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: probationId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const probation = await getCrmProbationById(probationId);
    if (!probation) notFound();

    const employeeRef = probation.employeeName || probation.employeeId || probationId;

    return (
        <EntityListShell
            title={`Edit · ${employeeRef}`}
            subtitle="Update probation details and evaluation criteria."
        >
            <ProbationForm
                initialData={{
                    ...(probation as Record<string, unknown>),
                    _id: probationId,
                }}
            />
        </EntityListShell>
    );
}
