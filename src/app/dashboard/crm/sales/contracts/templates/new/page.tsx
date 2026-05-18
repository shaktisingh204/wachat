import { ZoruButton } from '@/components/zoruui';
import {
  redirect } from 'next/navigation';
import { ArrowLeft,
  FileSignature } from 'lucide-react';

/**
 * New contract template page — server wrapper around
 * `<ContractTemplateForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { ContractTemplateForm } from '../_components/contract-template-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/sales/contracts/templates';

export default async function NewContractTemplatePage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

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
                    { label: 'New' },
                ]}
                title="New contract template"
                subtitle="A reusable contract body with default term, auto-renew flag and variables."
                icon={FileSignature}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <ContractTemplateForm />
        </div>
    );
}
