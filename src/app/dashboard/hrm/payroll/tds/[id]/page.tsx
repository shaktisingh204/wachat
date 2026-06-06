import React, { Suspense } from 'react';
import { Button } from '@/components/sabcrm/20ui';
import { notFound, redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getTdsRecordById, getTdsRecordsByEmployeeFY, type CrmTdsStatus } from '@/app/actions/crm-tds.actions';
import { TdsDetailClient } from './_components/tds-detail-client';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/tds';

async function TdsDetailContent({ id }: { id: string }) {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    const row = await getTdsRecordById(id);
    if (!row) notFound();

    const employeeName = (row.employeeName as string | undefined) ?? '—';
    const financialYear = (row.financialYear as string | undefined) ?? '—';
    const employeeId = (row.employeeId as string | undefined) ?? '';

    const fyView = employeeId
        ? await getTdsRecordsByEmployeeFY(employeeId, financialYear)
        : [];
        
    const fyTotal = fyView.reduce(
        (s, r) => s + (typeof r.tdsAmount === 'number' ? (r.tdsAmount as number) : 0),
        0,
    );
    
    // Ensure the data passed to Client Component doesn't contain ObjectId instances by converting to string where needed
    // or relying on them stringifying cleanly if passed. We use String(q._id) in Client.
    const sanitizedFyView = fyView.map(item => ({
        ...item,
        _id: String(item._id),
        employeeId: String(item.employeeId),
    }));

    const sanitizedRow = {
        ...row,
        _id: String(row._id),
        employeeId: String(row.employeeId),
    };

    return (
        <EntityDetailShell
            eyebrow="TDS"
            title={employeeName}
            back={{ href: BASE, label: 'TDS' }}
            actions={
                <Button asChild>
                    <Link href={`${BASE}/${id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
        >
            <TdsDetailClient
                row={sanitizedRow}
                initialFyView={sanitizedFyView}
                employeeName={employeeName}
                financialYear={financialYear}
                employeeId={employeeId}
                fyTotal={fyTotal}
            />
        </EntityDetailShell>
    );
}

export default async function TdsDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    return (
        <Suspense fallback={
            <EntityDetailShell
                eyebrow="TDS"
                title="Loading..."
                back={{ href: BASE, label: 'TDS' }}
            >
                <div className="h-40 animate-pulse bg-[var(--st-bg-muted)] rounded-md" />
            </EntityDetailShell>
        }>
            <TdsDetailContent id={id} />
        </Suspense>
    );
}
