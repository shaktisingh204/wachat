import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

/**
 * New PF/ESI record page — server wrapper around `<PfEsiForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { PfEsiForm } from '../_components/pf-esi-form';

export const dynamic = 'force-dynamic';

export default async function NewPfEsiPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Payroll', href: '/dashboard/hrm/payroll' },
                    { label: 'PF / ESI', href: '/dashboard/hrm/payroll/pf-esi' },
                    { label: 'New' },
                ]}
                title="New PF/ESI record"
                subtitle="Record an employee's monthly PF + ESI contributions and challan."
                icon={ShieldCheck}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/hrm/payroll/pf-esi">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />
            <PfEsiForm />
        </div>
    );
}
