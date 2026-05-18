import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, FileText } from 'lucide-react';

/**
 * New policy page — server wrapper around `<PolicyForm />`.
 *
 * The wrapper is intentionally tiny: the form is a client component that
 * binds to the `savePolicy` server action via `useActionState`, so all we
 * do here is render the page chrome.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { PolicyForm } from '../_components/policy-form';

export const dynamic = 'force-dynamic';

export default async function NewPolicyPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'Policies', href: '/dashboard/hrm/hr/policies' },
                    { label: 'New' },
                ]}
                title="New Policy"
                subtitle="Draft a new company policy, handbook section, or versioned guideline."
                icon={FileText}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/hrm/hr/policies">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <PolicyForm />
        </div>
    );
}
