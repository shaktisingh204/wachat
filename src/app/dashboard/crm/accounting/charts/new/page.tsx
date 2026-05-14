import { getCrmAccountGroups } from '@/app/actions/crm-accounting.actions';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { Network } from 'lucide-react';

import { CoaForm } from '../_components/coa-form';

export default async function NewChartOfAccountPage() {
    const groups = await getCrmAccountGroups();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Accounting', href: '/dashboard/crm/accounting' },
                    { label: 'Chart of Accounts', href: '/dashboard/crm/accounting/charts' },
                    { label: 'New' },
                ]}
                title="New Chart of Account"
                subtitle="Create a ledger account."
                icon={Network}
            />
            <CoaForm groups={groups} />
        </div>
    );
}
