import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, Landmark } from 'lucide-react';

/**
 * New Professional Tax record page — server wrapper around
 * `<ProfessionalTaxForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { ProfessionalTaxForm } from '../_components/professional-tax-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/professional-tax';

export default async function NewProfessionalTaxPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Payroll', href: '/dashboard/hrm/payroll' },
                    { label: 'Professional Tax', href: BASE },
                    { label: 'New' },
                ]}
                title="New PT record"
                subtitle="Record an employee's monthly professional tax filing."
                icon={Landmark}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />
            <ProfessionalTaxForm />
        </div>
    );
}
