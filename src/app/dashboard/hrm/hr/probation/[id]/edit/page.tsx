import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  ShieldCheck } from 'lucide-react';

/**
 * Edit probation page — server wrapper that loads the probation by id
 * and passes it as `initialData` to `<ProbationForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'Probation', href: BASE },
                    {
                        label: String(employeeRef),
                        href: `${BASE}/${probationId}`,
                    },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${employeeRef}`}
                subtitle="Update probation details and evaluation criteria."
                icon={ShieldCheck}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${probationId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <ProbationForm
                initialData={{
                    ...(probation as Record<string, unknown>),
                    _id: probationId,
                }}
            />
        </div>
    );
}
