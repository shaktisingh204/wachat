/**
 * /dashboard/crm/inventory/production-orders/new — thin wrapper.
 *
 * The `?bomId=` query param is read inside <PoForm /> and triggers the
 * server-side prefill helper.
 */

import { PoForm } from '../_components/po-form';

export const dynamic = 'force-dynamic';

export default function NewProductionOrderPage() {
  return <PoForm />;
}
