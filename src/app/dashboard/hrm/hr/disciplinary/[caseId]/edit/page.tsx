import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Gavel } from 'lucide-react';

/**
 * Edit disciplinary case page — server wrapper that loads the case by
 * id and passes it as `initialData` to `<DisciplinaryForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'Disciplinary', href: BASE },
                    { label: String(employeeRef), href: `${BASE}/${caseId}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${employeeRef}`}
                subtitle="Update case details, evidence and hearings."
                icon={Gavel}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${caseId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <DisciplinaryForm initialData={caseDoc} />
        </div>
    );
}
