import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Target } from 'lucide-react';

/**
 * Edit OKR page — server wrapper that loads the OKR by id and passes it
 * as `initialData` to `<OkrForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { getOkrById } from '@/app/actions/crm-okrs.actions';

import { OkrForm } from '../../_components/okr-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/okrs';

export default async function EditOkrPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: okrId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const okr = await getOkrById(okrId);
    if (!okr) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'OKRs', href: BASE },
                    { label: okr.objective, href: `${BASE}/${okrId}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${okr.objective}`}
                subtitle="Update objective and key results. Changes are revalidated immediately."
                icon={Target}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${okrId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <OkrForm initialData={okr} />
        </div>
    );
}
