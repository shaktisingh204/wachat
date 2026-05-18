import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  FileText } from 'lucide-react';

/**
 * Edit Form 16 page — server wrapper that loads the record and passes it
 * as `initialData` to `<Form16Form />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Payroll', href: '/dashboard/hrm/payroll' },
                    { label: 'Form 16', href: BASE },
                    { label: `${employeeName} · FY ${financialYear}`, href: `${BASE}/${id}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${employeeName}`}
                subtitle={`Update Form 16 for FY ${financialYear}.`}
                icon={FileText}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />
            <Form16Form initialData={row} />
        </div>
    );
}
