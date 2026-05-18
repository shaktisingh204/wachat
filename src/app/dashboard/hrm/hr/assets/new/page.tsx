import { ZoruButton } from '@/components/zoruui';
import { redirect } from 'next/navigation';
import { ArrowLeft, Package } from 'lucide-react';

/**
 * New asset page — server wrapper around `<AssetForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { AssetForm } from '../_components/asset-form';

export const dynamic = 'force-dynamic';

export default async function NewAssetPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'HR', href: '/dashboard/hrm/hr' },
                    { label: 'Assets', href: '/dashboard/hrm/hr/assets' },
                    { label: 'New' },
                ]}
                title="New Asset"
                subtitle="Register a new company-owned asset."
                icon={Package}
                actions={
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/hrm/hr/assets">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />

            <AssetForm />
        </div>
    );
}
