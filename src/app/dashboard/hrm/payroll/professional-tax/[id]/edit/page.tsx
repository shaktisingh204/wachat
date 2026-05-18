import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Landmark } from 'lucide-react';

/**
 * Edit Professional Tax record page — server wrapper.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { getProfessionalTaxRecordById } from '@/app/actions/crm-professional-tax.actions';

import { ProfessionalTaxForm } from '../../_components/professional-tax-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/professional-tax';

export default async function EditProfessionalTaxPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const row = await getProfessionalTaxRecordById(id);
    if (!row) notFound();

    const employeeName =
        (row.employeeName as string | undefined) ?? 'PT record';
    const month = (row.month as string | undefined) ?? '—';

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Payroll', href: '/dashboard/hrm/payroll' },
                    { label: 'Professional Tax', href: BASE },
                    {
                        label: `${employeeName} · ${month}`,
                        href: `${BASE}/${id}`,
                    },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${employeeName}`}
                subtitle={month}
                icon={Landmark}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />
            <ProfessionalTaxForm initialData={row} />
        </div>
    );
}
