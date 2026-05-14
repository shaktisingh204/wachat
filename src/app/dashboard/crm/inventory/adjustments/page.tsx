/**
 * Stock Adjustments — list page (rebuilt per §1D).
 *
 * Server entry point; delegates to `<AdjustmentsListClient>` for KPI
 * strip + filters + table + bulk bar + pagination.
 */

export const dynamic = 'force-dynamic';

import { AdjustmentsListClient } from './_components/adjustments-list-client';

export default function StockAdjustmentsPage() {
    return <AdjustmentsListClient />;
}
