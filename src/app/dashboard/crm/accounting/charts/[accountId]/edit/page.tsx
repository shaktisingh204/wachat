import { notFound } from 'next/navigation';
import { Network } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
    getCrmAccountGroups,
    getCrmChartOfAccountById,
} from '@/app/actions/crm-accounting.actions';

import { CoaForm } from '../../_components/coa-form';

export default async function EditChartOfAccountPage(props: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await props.params;
    const [account, groups] = await Promise.all([
        getCrmChartOfAccountById(accountId),
        getCrmAccountGroups(),
    ]);
    if (!account) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Accounting', href: '/dashboard/crm/accounting' },
                    { label: 'Chart of Accounts', href: '/dashboard/crm/accounting/charts' },
                    {
                        label: account.name,
                        href: `/dashboard/crm/accounting/charts/${accountId}`,
                    },
                    { label: 'Edit' },
                ]}
                title={`Edit ${account.name}`}
                subtitle="Update this ledger account."
                icon={Network}
            />
            <CoaForm initial={account} groups={groups} />
        </div>
    );
}
