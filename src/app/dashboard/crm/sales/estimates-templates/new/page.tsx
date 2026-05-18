import { ZoruButton } from '@/components/zoruui';
import {
  redirect } from 'next/navigation';
import { ArrowLeft,
  LayoutTemplate } from 'lucide-react';

/**
 * New estimate template — server wrapper around `<EstimateTemplateForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { EstimateTemplateForm } from '../_components/estimate-template-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/estimates-templates';

export default async function NewEstimateTemplatePage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="New estimate template"
                subtitle="Define a reusable template with default line items and terms."
                icon={LayoutTemplate}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to templates
                        </Link>
                    </ZoruButton>
                }
            />

            <EstimateTemplateForm />
        </div>
    );
}
