/**
 * Stock Transfers — list page (§1B inventory rebuild).
 *
 * Server entry point; delegates to `<StockTransfersListClient>` for KPI
 * strip, filter row, table and pagination.
 */

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { StockTransfersListClient } from './_components/stock-transfers-list-client';
import StockTransfersLoading from './loading';

export default function StockTransfersPage() {
    return (
        <Suspense fallback={<StockTransfersLoading />}>
            <StockTransfersListClient />
        </Suspense>
    );
}
