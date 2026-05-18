import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, GitCompare } from 'lucide-react';

/**
 * New bank reconciliation — server wrapper around `<ReconciliationForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { ReconciliationForm } from '../_components/reconciliation-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/banking/reconciliation';

export default async function NewReconciliationPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Banking', href: '/dashboard/crm/banking' },
                    { label: 'Reconciliation', href: BASE },
                    { label: 'New' },
                ]}
                title="New Reconciliation"
                subtitle="Record a bank reconciliation pass with opening/closing balances."
                icon={GitCompare}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to list
                        </Link>
                    </ZoruButton>
                }
            />
            <ReconciliationForm />
        </div>
    );
}
