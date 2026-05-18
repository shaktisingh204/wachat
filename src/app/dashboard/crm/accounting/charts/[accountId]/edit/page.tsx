import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
        <EntityDetailShell
            eyebrow="CHART OF ACCOUNT"
            title={`Edit ${account.name}`}
            back={{ href: `/dashboard/crm/accounting/charts/${accountId}`, label: 'Back to account' }}
        >
            <CoaForm initial={account} groups={groups} />
        </EntityDetailShell>
    );
}
