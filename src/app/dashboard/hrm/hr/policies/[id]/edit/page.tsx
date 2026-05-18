import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  FileText } from 'lucide-react';

/**
 * Edit policy page — server wrapper that loads the policy by id and
 * passes it as `initialData` to `<PolicyForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { getPolicyById } from '@/app/actions/crm-policies.actions';

import { PolicyForm } from '../../_components/policy-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/policies';

export default async function EditPolicyPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: policyId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const policy = await getPolicyById(policyId);
    if (!policy) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'Policies', href: BASE },
                    { label: policy.name, href: `${BASE}/${policyId}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${policy.name}`}
                subtitle="Update policy fields. Changes are revalidated immediately."
                icon={FileText}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${policyId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <PolicyForm initialData={policy} />
        </div>
    );
}
