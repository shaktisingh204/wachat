import { ZoruCard, ZoruPageDescription, ZoruPageHeader, ZoruPageHeading, ZoruPageTitle } from '@/components/zoruui';
import {
  ArrowUpRight,
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
  } from 'lucide-react';

/**
 * Inventory module overview — tile grid linking every sub-feature.
 *
 * Was a client-side `router.replace('/dashboard/crm/inventory/items')` shim.
 */

import Link from 'next/link';

interface NavTile {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tiles: NavTile[] = [
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

export default function CrmInventoryHubPage() {
  return (
    <div className="flex min-h-full flex-col gap-6 p-4 sm:p-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Inventory</ZoruPageTitle>
          <ZoruPageDescription>
            Items, warehouses, stock movements, and inventory valuation.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.href} href={tile.href} className="group">
              <ZoruCard className="h-full p-5 transition-shadow group-hover:shadow-[var(--zoru-shadow-md)]">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-medium text-zoru-ink">{tile.title}</p>
                  <ArrowUpRight className="h-4 w-4 text-zoru-ink-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zoru-ink" />
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-zoru-ink-muted">
                  {tile.description}
                </p>
              </ZoruCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
