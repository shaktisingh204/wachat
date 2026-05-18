import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, Layers } from 'lucide-react';

/**
 * New asset assignment page — server wrapper around
 * `<AssetAssignmentForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { AssetAssignmentForm } from '../_components/asset-assignment-form';

export const dynamic = 'force-dynamic';

export default async function NewAssetAssignmentPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'Asset assignments', href: '/dashboard/hrm/hr/asset-assignments' },
                    { label: 'New' },
                ]}
                title="New assignment"
                subtitle="Issue an asset to an employee."
                icon={Layers}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/hrm/hr/asset-assignments">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <AssetAssignmentForm />
        </div>
    );
}
