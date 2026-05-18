import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, FileText } from 'lucide-react';

/**
 * New Form 16 page — server wrapper around `<Form16Form />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { Form16Form } from '../_components/form-16-form';

export const dynamic = 'force-dynamic';

export default async function NewForm16Page() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'Payroll', href: '/dashboard/hrm/payroll' },
                    { label: 'Form 16', href: '/dashboard/hrm/payroll/form-16' },
                    { label: 'New' },
                ]}
                title="New Form 16"
                subtitle="Create a tax certificate record for an employee. Attach the generated PDF after creation."
                icon={FileText}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/hrm/payroll/form-16">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />
            <Form16Form />
        </div>
    );
}
