/**
 * Create payout — `/dashboard/crm/purchases/payouts/new`.
 *
 * Server component: renders the canonical `<PayoutForm>` (backed by
 * `savePayout` → `crmPayoutsApi.create`), the same typed store the Payouts
 * list reads from. Previously this page used the generic
 * `LiveDocumentEditor`, which persisted to the unrelated `live_documents`
 * collection so created payouts never appeared in the list.
 */

import { PayoutForm } from '../_components/payout-form-v2';

export const dynamic = 'force-dynamic';

export default function NewPayoutPage() {
    return <PayoutForm />;
}
