import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  FileMinus } from 'lucide-react';

/**
 * Edit TDS record page — server wrapper that loads the record and passes
 * it as `initialData` to `<TdsForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Payroll', href: '/dashboard/hrm/payroll' },
                    { label: 'TDS', href: BASE },
                    {
                        label: `${employeeName} · FY ${financialYear} · ${quarter}`,
                        href: `${BASE}/${id}`,
                    },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${employeeName}`}
                subtitle={`FY ${financialYear} · ${quarter}`}
                icon={FileMinus}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />
            <TdsForm initialData={row} />
        </div>
    );
}
