import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  ShieldCheck } from 'lucide-react';

/**
 * Edit PF/ESI record page — server wrapper.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Payroll', href: '/dashboard/hrm/payroll' },
                    { label: 'PF / ESI', href: BASE },
                    { label: `${employeeName} · ${month}`, href: `${BASE}/${id}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${employeeName}`}
                subtitle={month}
                icon={ShieldCheck}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />
            <PfEsiForm initialData={row} />
        </div>
    );
}
