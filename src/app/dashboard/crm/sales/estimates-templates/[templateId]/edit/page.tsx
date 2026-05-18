import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit estimate template — server wrapper.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getEstimateTemplateById } from '@/app/actions/crm-estimate-templates.actions';

import { EstimateTemplateForm } from '../../_components/estimate-template-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/estimates-templates';

export default async function EditEstimateTemplatePage({
    params,
}: {
    params: Promise<{ templateId: string }>;
}) {
    const { templateId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const tpl = await getEstimateTemplateById(templateId);
    if (!tpl) notFound();

    const name = (tpl.name as string | undefined) || 'Estimate template';

    return (
        <EntityDetailShell
            eyebrow="ESTIMATE TEMPLATE"
            title={`Edit · ${name}`}
            back={{ href: `${BASE}/${templateId}`, label: 'Template detail' }}
        >
            <EstimateTemplateForm
                initialData={tpl as Record<string, unknown>}
            />
        </EntityDetailShell>
    );
}
