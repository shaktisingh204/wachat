import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  LayoutTemplate } from 'lucide-react';

/**
 * Edit estimate template — server wrapper.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`Edit · ${name}`}
                subtitle="Update template body, default line items, and terms."
                icon={LayoutTemplate}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${templateId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <EstimateTemplateForm
                initialData={tpl as Record<string, unknown>}
            />
        </div>
    );
}
