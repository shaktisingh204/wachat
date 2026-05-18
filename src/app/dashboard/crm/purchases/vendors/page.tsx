/**
 * Vendors list — `/dashboard/crm/purchases/vendors`
 * (P1.1B Wave 3 — Purchases rebuild · §1D.1).
 *
 * Thin server page that mounts the canonical `<VendorsListClient>`.
 * The client component already self-hydrates via `getCrmVendors()` and
 * composes the §1D.1 chrome (KPI strip + filters + bulk-bar +
 * EntityListShell + dense table + confirm dialogs), so this wrapper
 * page is intentionally tiny — matches the canonical Accounts pattern.
 */

import { VendorsListClient } from './_components/vendors-list-client';

export const dynamic = 'force-dynamic';

export default function VendorsPage() {
    return <VendorsListClient />;
}
