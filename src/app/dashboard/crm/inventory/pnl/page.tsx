import { generateProductPnlData } from '@/app/actions/crm-reports.actions';
import { getPnlDeepKpis } from '@/app/actions/crm-inventory.actions';
import { ProductPnlClient } from './client';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Product-wise P&L | SabNode',
    description: 'Product-wise P&L over the trailing six months.',
};

export default async function ProductPnlDeepPage() {
    const [pnlRes, deep] = await Promise.all([
        generateProductPnlData(),
        getPnlDeepKpis(),
    ]);

    if (pnlRes.error) {
        throw new Error(pnlRes.error);
    }

    const reportData = (pnlRes.data as any[]) ?? [];

    return (
        <ProductPnlClient 
            initialReportData={reportData} 
            initialKpis={deep} 
        />
    );
}
