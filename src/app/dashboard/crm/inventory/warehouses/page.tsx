/**
 * Warehouses — list page (rebuilt per §1D).
 *
 * Server entry point; delegates to `<WarehousesListClient>` which owns
 * KPI strip + filters + table + bulk bar + pagination. Server actions
 * (`getCrmWarehousesPaginated`, `getCrmWarehouseKpis`, etc.) are
 * imported and called inside the client because the page already paged
 * through state interactively.
 */

export const dynamic = 'force-dynamic';

import { WarehousesListClient } from './_components/warehouses-list-client';

export default function WarehousesPage() {
    return <WarehousesListClient />;
}
