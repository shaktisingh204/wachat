import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getCrmChartOfAccountById } from '@/app/actions/crm-accounting.actions';

export default async function ChartOfAccountActivityPage(props: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await props.params;
    const account = await getCrmChartOfAccountById(accountId);
    if (!account) notFound();

    return (
        <EntityDetailShell
            eyebrow="CHART OF ACCOUNT"
            title={account.name}
            back={{ href: `/dashboard/crm/accounting/charts/${accountId}`, label: 'Back to account' }}
        >
            <EntityAuditTimeline entityKind="chart_of_account" entityId={accountId} />
        </EntityDetailShell>
    );
}
