import { redirect } from 'next/navigation';

/**
 * New policy page — server wrapper around `<PolicyForm />`.
 *
 * The wrapper is intentionally tiny: the form is a client component that
 * binds to the `savePolicy` server action via `useActionState`, so all we
 * do here is render the page chrome.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getSession } from '@/app/actions/user.actions';

import { PolicyForm } from '../_components/policy-form';

export const dynamic = 'force-dynamic';

export default async function NewPolicyPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <EntityListShell
            title="New Policy"
            subtitle="Draft a new company policy, handbook section, or versioned guideline."
        >
            <PolicyForm />
        </EntityListShell>
    );
}
