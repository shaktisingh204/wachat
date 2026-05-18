import { ZoruButton } from '@/components/zoruui';
import { ArrowLeft, Bell } from 'lucide-react';

/**
 * HR Notices — new notice page.
 *
 * Server component that renders the shared <NoticeForm /> with no
 * `initialData`, putting it in "create" mode. The form action redirects
 * to the detail page on success.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { NoticeForm } from '../_components/notice-form';

export const dynamic = 'force-dynamic';

export default function NewNoticePage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HRM', href: '/dashboard/hrm' },
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    {
                        label: 'Notices',
                        href: '/dashboard/hrm/hr/notices',
                    },
                    { label: 'New' },
                ]}
                title="New Notice"
                subtitle="Draft a new advisory, circular, or company-wide notice."
                icon={Bell}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/hrm/hr/notices">
                            <ArrowLeft className="mr-1.5 h-4 w-4" />
                            Back
                        </Link>
                    </ZoruButton>
                }
            />

            <NoticeForm />
        </div>
    );
}
