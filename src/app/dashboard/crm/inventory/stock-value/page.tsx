import { Suspense } from 'react';
import StockValueDeepClient from './client';
import { generateStockValueReport } from '@/app/actions/crm-reports.actions';
import { getStockValueDeepKpis } from '@/app/actions/crm-inventory.actions';

export default async function StockValueDeepPage() {
    const [valuation, deep] = await Promise.all([
        generateStockValueReport(),
        getStockValueDeepKpis(),
    ]);

    // Handle potential errors from server actions
    if (valuation.error) {
        throw new Error(valuation.error);
    }

    return (
        <StockValueDeepClient
            reportData={valuation.data || []}
            summary={valuation.summary || {}}
            kpis={deep}
        />
    );
}
