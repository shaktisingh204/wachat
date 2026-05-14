import { notFound } from 'next/navigation';
import { History } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getCrmChartOfAccountById } from '@/app/actions/crm-accounting.actions';

export default async function ChartOfAccountActivityPage(props: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await props.params;
    const account = await getCrmChartOfAccountById(accountId);
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
                    { label: 'Activity' },
                ]}
                title="Activity"
                subtitle={`Audit timeline for ${account.name}.`}
                icon={History}
            />
            <EntityAuditTimeline entityKind="chart_of_account" entityId={accountId} />
        </div>
    );
}
