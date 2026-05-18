import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Layers } from 'lucide-react';

/**
 * Edit asset assignment page — server wrapper.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { getAssetAssignmentById } from '@/app/actions/crm-asset-assignments.actions';

import { AssetAssignmentForm } from '../../_components/asset-assignment-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/hrm/hr/asset-assignments';

export default async function EditAssetAssignmentPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const assignment = await getAssetAssignmentById(id);
    if (!assignment) notFound();

    const title = assignment.asset_name || assignment.asset_id;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'Asset assignments', href: BASE },
                    { label: title, href: `${BASE}/${id}` },
                    { label: 'Edit' },
                ]}
                title={`Edit · ${title}`}
                subtitle="Update assignment fields. Changes are revalidated immediately."
                icon={Layers}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href={`${BASE}/${id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to detail
                        </Link>
                    </ZoruButton>
                }
            />

            <AssetAssignmentForm initialData={assignment} />
        </div>
    );
}
