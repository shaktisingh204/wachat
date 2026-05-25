import { getCrmAccountGroups } from '@/app/actions/crm-accounting.actions';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

import { CoaForm } from '../_components/coa-form';

export const dynamic = 'force-dynamic';

export default async function NewChartOfAccountPage() {
    const groups = await getCrmAccountGroups();

    return (
        <EntityDetailShell
            eyebrow="CHART OF ACCOUNT"
            title="New Chart of Account"
            back={{ href: '/dashboard/crm/accounting/charts', label: 'Chart of Accounts' }}
        >
            <CoaForm groups={groups} />
        </EntityDetailShell>
    );
}
