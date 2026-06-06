import {
  notFound,
  redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import type { StatusTone } from '@/components/crm/status-pill';
import { Button } from '@/components/sabcrm/20ui';

import { getSession } from '@/app/actions/user.actions';
import { getSalaryStructureDoc } from '@/app/actions/crm-salary-structures.actions';
import type { CrmSalaryStructureStatus } from '@/lib/rust-client/crm-salary-structures';
import { SalaryStructureClient } from './salary-structure-client';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/salary-structure';

const STATUS_TONE: Record<CrmSalaryStructureStatus, StatusTone> = {
    active: 'green',
    archived: 'neutral',
};

async function SalaryStructureContent({ id }: { id: string }) {
    const doc = await getSalaryStructureDoc(id);
    if (!doc) notFound();

    const status = (doc.status ?? 'active') as CrmSalaryStructureStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';

    return (
        <EntityDetailShell
            eyebrow="SALARY STRUCTURE"
            title={`Structure · ${doc.employeeName ?? doc.employeeId}`}
            status={{ label: status, tone: tone as 'green' | 'neutral' }}
            back={{ href: BASE, label: 'Salary structures' }}
            actions={
                <Button asChild>
                    <Link href={`${BASE}/${id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            }
        >
            <SalaryStructureClient doc={doc} />
        </EntityDetailShell>
    );
}

export default async function SalaryStructureDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <Suspense fallback={
            <EntityDetailShell
                eyebrow="SALARY STRUCTURE"
                title="Loading structure..."
                back={{ href: BASE, label: 'Salary structures' }}
            >
                <div className="p-6">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 w-1/4 rounded bg-[var(--st-bg-muted)]"></div>
                        <div className="h-64 rounded bg-[var(--st-bg-muted)]"></div>
                    </div>
                </div>
            </EntityDetailShell>
        }>
            <SalaryStructureContent id={id} />
        </Suspense>
    );
}
