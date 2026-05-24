import { redirect } from 'next/navigation';

/**
 * New Professional Tax record page — server wrapper around
 * `<ProfessionalTaxForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';

import { ProfessionalTaxForm } from '../_components/professional-tax-form';
import { BulkUploadPtCard } from '../_components/bulk-upload-pt-card';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/payroll/professional-tax';

export default async function NewProfessionalTaxPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New PT record"
            subtitle="Record an employee's monthly professional tax filing, or bulk upload via CSV."
        >
            <div className="flex flex-col gap-6">
                <ProfessionalTaxForm />
                <BulkUploadPtCard />
            </div>
        </EntityListShell>
    );
}
