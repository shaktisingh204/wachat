/**
 * Stock Transfers — list page (§1B inventory rebuild).
 *
 * Server entry point; delegates to `<StockTransfersListClient>` for KPI
 * strip, filter row, table and pagination.
 */

export const dynamic = 'force-dynamic';

import { StockTransfersListClient } from './_components/stock-transfers-list-client';

export default function StockTransfersPage() {
    return <StockTransfersListClient />;
}
