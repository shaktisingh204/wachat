
'use client';

import { redirect } from 'next/navigation';

export default function ShopManageIndexPage({ params }: { params: { shopId: string }}) {
    // Default to the settings page when a user lands on the base management URL.
    redirect(`/dashboard/facebook/custom-ecommerce/manage/${params.shopId}/settings`);
}
