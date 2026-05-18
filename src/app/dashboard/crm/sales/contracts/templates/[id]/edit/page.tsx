import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit contract template page — server wrapper. Loads the template
 * by id and forwards it as `initialData` to `<ContractTemplateForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getContractTemplateById } from '@/app/actions/crm-contract-templates.actions';

import { ContractTemplateForm } from '../../_components/contract-template-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/contracts/templates';

export default async function EditContractTemplatePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const template = await getContractTemplateById(id);
    if (!template) notFound();

    return (
        <EntityDetailShell
            eyebrow="CONTRACT TEMPLATE"
            title={`Edit · ${template.name}`}
            back={{ href: `${BASE}/${id}`, label: 'Template detail' }}
        >
            <ContractTemplateForm initialData={template} />
        </EntityDetailShell>
    );
}
