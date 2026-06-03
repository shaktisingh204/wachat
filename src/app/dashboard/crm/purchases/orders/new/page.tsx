/**
 * Create purchase order — `/dashboard/crm/purchases/orders/new`.
 *
 * Server component: renders the canonical `<PurchaseOrderForm>` (backed
 * by `savePurchaseOrderAction` → `crmPurchaseOrdersApi.create`), the same
 * typed store the Purchase Orders list reads from. Previously this page
 * used the generic `LiveDocumentEditor`, which persisted to the unrelated
 * `live_documents` collection so created orders never appeared in the
 * list.
 */

import { getSession } from '@/app/actions/user.actions';

import { PurchaseOrderForm } from '../_components/purchase-order-form';

export const dynamic = 'force-dynamic';

export default async function NewPurchaseOrderPage() {
    const session = await getSession();
    const currentUserId = session?.user?._id ? String(session.user._id) : null;

    return <PurchaseOrderForm currentUserId={currentUserId} />;
}
