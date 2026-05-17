/**
 * Vendor Types settings — `/dashboard/crm/purchases/vendors/types`.
 *
 * Settings-style master list for the `crm_vendor_types` collection
 * (or `/v1/crm/vendor-types` Rust BFF). Uses `<SettingsEntityShell>`
 * for the §1D.4 chrome: KPI strip, inline create/edit dialog, bulk
 * delete + CSV export, and a search bar.
 *
 * RBAC: `crm_vendor_type`.
 */

import { redirect } from 'next/navigation';
import { Tags } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { VendorTypesPageClient } from './_components/vendor-types-page-client';

export const dynamic = 'force-dynamic';

export default async function VendorTypesPage() {
    const session = await getSession();
    if (!session?.user) redirect('/login');

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Purchases', href: '/dashboard/crm/purchases' },
                    { label: 'Vendors', href: '/dashboard/crm/purchases/vendors' },
                    { label: 'Types' },
                ]}
                title="Vendor Types"
                subtitle="Classify vendors by category — supplier, contractor, service provider, etc."
                icon={Tags}
            />
            <VendorTypesPageClient />
        </div>
    );
}
