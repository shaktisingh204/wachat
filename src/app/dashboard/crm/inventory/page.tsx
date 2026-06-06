import { Suspense } from 'react';
import {
    AlertTriangle,
    ArrowRightLeft,
    Boxes,
    CalendarClock,
    ClipboardList,
    Factory,
    ListChecks,
    Package,
    PackageCheck,
    Repeat2,
    Store,
    TrendingUp,
    Truck,
    Warehouse,
    Loader2,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { type CrmStockAdjustmentDoc } from '@/lib/rust-client/crm-stock-adjustments';

import {
    HubKpiGrid,
    HubQuickLinkGrid,
    HubRecentList,
    type HubKpi,
    type HubQuickLink,
    type HubRecentRow,
} from '../_components/hub-kpi-grid';
import {
    countByUser,
    recentByUser,
    sumByUser,
} from '../_components/hub-data';
import { fmtDate, fmtINR } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type LegacyAdjustmentDoc = CrmStockAdjustmentDoc & { itemName?: string; qty?: number; direction?: string; movementType?: string };

const QUICK_LINKS: HubQuickLink[] = [
    { href: '/dashboard/crm/inventory/items', title: 'Items', description: 'Products, SKUs, services, and their pricing.', icon: Package },
    { href: '/dashboard/crm/inventory/warehouses', title: 'Warehouses', description: 'Stock locations and storage facilities.', icon: Warehouse },
    { href: '/dashboard/crm/inventory/vendors', title: 'Vendors', description: 'Suppliers linked to inventory items.', icon: Store },
    { href: '/dashboard/crm/inventory/purchase-orders', title: 'Purchase Orders', description: 'Inbound orders to replenish stock.', icon: ClipboardList },
    { href: '/dashboard/crm/inventory/grn', title: 'Goods Received', description: 'GRNs — receipts for inbound stock deliveries.', icon: Truck },
    { href: '/dashboard/crm/inventory/adjustments', title: 'Adjustments', description: 'Stock corrections — gains, losses, write-offs.', icon: ListChecks },
    { href: '/dashboard/crm/inventory/stock-transfers', title: 'Stock Transfers', description: 'Move stock between warehouses.', icon: ArrowRightLeft },
    { href: '/dashboard/crm/inventory/batch-expiry', title: 'Batch / Expiry', description: 'Track batches, lots, and expiry dates.', icon: CalendarClock },
    { href: '/dashboard/crm/inventory/bom', title: 'Bill of Materials', description: 'Component lists for manufactured items.', icon: Boxes },
    { href: '/dashboard/crm/inventory/production-orders', title: 'Production Orders', description: 'Manufacturing runs and assembly jobs.', icon: Factory },
    { href: '/dashboard/crm/inventory/all-transactions', title: 'All Transactions', description: 'Every inventory movement, in one ledger.', icon: Repeat2 },
    { href: '/dashboard/crm/inventory/party-transactions', title: 'Party Transactions', description: 'Stock movements grouped by vendor or customer.', icon: PackageCheck },
    { href: '/dashboard/crm/inventory/stock-value', title: 'Stock Value', description: 'Current valuation of inventory on hand.', icon: TrendingUp },
    { href: '/dashboard/crm/inventory/pnl', title: 'Inventory P&L', description: 'Profit and loss attributable to inventory.', icon: TrendingUp },
];

async function InventoryOverviewData() {
    const [itemCount, warehouseCount, lowStockCount, stockValue, recentAdjustments] = await Promise.all([
        countByUser('crm_items'),
        countByUser('crm_warehouses'),
        countByUser('crm_items', {
            $expr: { $lte: ['$currentStock', '$reorderLevel'] },
        }),
        sumByUser('crm_items', 'stockValue'),
        recentByUser<LegacyAdjustmentDoc>('crm_stock_adjustments', {
            sortField: 'createdAt',
            limit: 5,
        }),
    ]);

    const kpis: HubKpi[] = [
        {
            label: 'Items',
            value: itemCount.toLocaleString(),
            icon: Package,
            hint: `${warehouseCount} warehouse${warehouseCount === 1 ? '' : 's'}`,
            href: '/dashboard/crm/inventory/items',
        },
        {
            label: 'Low Stock',
            value: lowStockCount,
            icon: AlertTriangle,
            tone: lowStockCount > 0 ? 'danger' : 'success',
            href: '/dashboard/crm/inventory/items?filter=low-stock',
        },
        {
            label: 'Stock Value',
            value: fmtINR(stockValue),
            icon: TrendingUp,
            href: '/dashboard/crm/inventory/stock-value',
        },
        {
            label: 'Recent Adjustments',
            value: recentAdjustments.length,
            icon: ListChecks,
            href: '/dashboard/crm/inventory/adjustments',
        },
    ];

    const recentRows: HubRecentRow[] = recentAdjustments.map((a) => ({
        id: String(a._id),
        primary: a.itemName || a.reason || 'Stock adjustment',
        secondary: a.movementType || a.direction || 'adjustment',
        trailing: `${a.quantity ?? a.qty ?? 0} · ${fmtDate(a.createdAt)}`,
        href: '/dashboard/crm/inventory/adjustments',
    }));

    return (
        <div className="flex flex-col gap-6">
            <HubKpiGrid kpis={kpis} />
            <HubQuickLinkGrid links={QUICK_LINKS} />
            <HubRecentList
                title="Recent stock movements"
                rows={recentRows}
                emptyHint="No stock movements yet."
                viewAllHref="/dashboard/crm/inventory/all-transactions"
            />
        </div>
    );
}

function InventoryLoading() {
    return (
        <div className="flex h-64 w-full items-center justify-center rounded-lg border border-dashed border-[var(--st-border)]">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--st-text-tertiary)]" />
        </div>
    );
}

export default function CrmInventoryHubPage() {
    return (
        <EntityListShell
            title="Inventory"
            subtitle="Items, warehouses, stock movements, and inventory valuation."
        >
            <Suspense fallback={<InventoryLoading />}>
                <InventoryOverviewData />
            </Suspense>
        </EntityListShell>
    );
}
