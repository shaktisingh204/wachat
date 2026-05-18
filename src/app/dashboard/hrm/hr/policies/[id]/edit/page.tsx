import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit policy page — server wrapper that loads the policy by id and
 * passes it as `initialData` to `<PolicyForm />`.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
        <EntityListShell
            title={`Edit · ${policy.name}`}
            subtitle="Update policy fields. Changes are revalidated immediately."
        >
            <PolicyForm initialData={policy} />
        </EntityListShell>
    );
}
