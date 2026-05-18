import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, FileMinus } from 'lucide-react';

/**
 * New TDS record page — server wrapper around `<TdsForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { TdsForm } from '../_components/tds-form';

export const dynamic = 'force-dynamic';

export default async function NewTdsPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Payroll', href: '/dashboard/hrm/payroll' },
                    { label: 'TDS', href: '/dashboard/hrm/payroll/tds' },
                    { label: 'New' },
                ]}
                title="New TDS record"
                subtitle="Record TDS for an employee for a specific FY + quarter."
                icon={FileMinus}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/hrm/payroll/tds">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />
            <TdsForm />
        </div>
    );
}
