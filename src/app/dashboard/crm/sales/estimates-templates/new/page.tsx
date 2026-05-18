import {
  redirect } from 'next/navigation';

/**
 * New estimate template — server wrapper around `<EstimateTemplateForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { EstimateTemplateForm } from '../_components/estimate-template-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/estimates-templates';

export default async function NewEstimateTemplatePage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityDetailShell
            eyebrow="ESTIMATE TEMPLATE"
            title="New estimate template"
            back={{ href: BASE, label: 'Estimate Templates' }}
        >
            <EstimateTemplateForm />
        </EntityDetailShell>
    );
}
