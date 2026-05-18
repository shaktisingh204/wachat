import {
  redirect } from 'next/navigation';

/**
 * New contract template page — server wrapper around
 * `<ContractTemplateForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { ContractTemplateForm } from '../_components/contract-template-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/contracts/templates';

export default async function NewContractTemplatePage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            eyebrow="CONTRACT TEMPLATE"
            title="New contract template"
            back={{ href: BASE, label: 'Templates' }}
        >
            <ContractTemplateForm />
        </EntityDetailShell>
    );
}
