import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  FileSignature } from 'lucide-react';

/**
 * Edit contract template page — server wrapper. Loads the template
 * by id and forwards it as `initialData` to `<ContractTemplateForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Sales', href: '/dashboard/crm/sales' },
                    {
                        label: 'Contracts',
                        href: '/dashboard/crm/sales/contracts',
                    },
                    { label: 'Templates', href: BASE },
                    { label: template.name, href: `${BASE}/${id}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${template.name}`}
                subtitle="Update template body, defaults and variables."
                icon={FileSignature}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <ContractTemplateForm initialData={template} />
        </div>
    );
}
