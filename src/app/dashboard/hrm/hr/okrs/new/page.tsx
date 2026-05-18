import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, Target } from 'lucide-react';

/**
 * New OKR page — server wrapper around `<OkrForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { OkrForm } from '../_components/okr-form';

export const dynamic = 'force-dynamic';

export default async function NewOkrPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'OKRs', href: '/dashboard/hrm/hr/okrs' },
                    { label: 'New' },
                ]}
                title="New OKR"
                subtitle="Define a new objective and its key results."
                icon={Target}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/hrm/hr/okrs">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <OkrForm />
        </div>
    );
}
