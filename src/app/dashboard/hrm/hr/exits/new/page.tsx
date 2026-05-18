import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, LogOut } from 'lucide-react';

/**
 * New exit page — server wrapper around `<ExitForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { ExitForm } from '../_components/exit-form';

export const dynamic = 'force-dynamic';

export default async function NewExitPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'Exits', href: '/dashboard/hrm/hr/exits' },
                    { label: 'New' },
                ]}
                title="New Exit"
                subtitle="Record an offboarding case with clearance and F&F tracking."
                icon={LogOut}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/hrm/hr/exits">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <ExitForm />
        </div>
    );
}
