/**
 * Vendors list — `/dashboard/crm/purchases/vendors`
 * (P1.1B Wave 3 — Purchases rebuild · §1D.1).
 *
 * Server component that wraps `<VendorsListClient>` in a Suspense boundary.
 * Fetches vendor directory data on the server first, accelerating initial render.
 */

import React, { Suspense } from 'react';
import { getCrmVendors } from '@/app/actions/crm-vendors.actions';
import { VendorsListClient } from './_components/vendors-list-client';
import PurchasesLoading from '../loading';

export const dynamic = 'force-dynamic';

async function VendorListContainer() {
    const vendors = await getCrmVendors();
    return <VendorsListClient initialVendors={vendors ?? []} />;
}

export default async function VendorsPage() {
    return (
        <Suspense fallback={<PurchasesLoading />}>
            <VendorListContainer />
        </Suspense>
    );
}
