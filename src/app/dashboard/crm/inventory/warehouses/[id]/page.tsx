import { ZoruBadge, ZoruButton, ZoruCard, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import {
    Archive,
  BadgeCheck,
  History,
  Pencil,
  Snowflake,
  } from 'lucide-react';

/**
 * Warehouse detail — server route per §1D.
 *
 * Layout:
 *   <EntityDetailShell>
 *     ├── Header (eyebrow, title, status pill, Edit/Set default/Archive/Activity)
 *     ├── Body
 *     │     ├── Basic
 *     │     ├── Address (with cascade fields)
 *     │     ├── Contact
 *     │     ├── Capacity
 *     │     └── Inventory summary card (items count + total stock value)
 *     ├── Right rail
 *     │     └── Related entities (Adjustments · GRNs · Items)
 *     └── Audit footer (entityKind: 'warehouse')
 */
import Link from 'next/link';

import {
    EntityDetailShell,
    type EntityStatusTone,
} from '@/components/crm/entity-detail-shell';

import {
    getCrmWarehouseById,
    getCrmWarehouseInventorySummary,
    getCrmWarehouseStockByItem,
} from '@/app/actions/crm-warehouses.actions';

import { WarehouseDetailActions } from '../_components/warehouse-detail-actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

interface PageProps {
    params: Promise<{ id: string }>;
}

function fmt(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
}

function statusTone(status?: string, archived?: boolean): EntityStatusTone {
    if (archived) return 'red';
    const s = (status ?? 'active').toLowerCase();
    if (s === 'active') return 'green';
    if (s === 'inactive') return 'amber';
    if (s === 'archived') return 'red';
    return 'neutral';
}

function typeLabel(type?: string): string {
    switch (type) {
        case 'main':
            return 'Main';
        case 'branch':
            return 'Branch';
        case 'franchise':
            return 'Franchise';
        case '3pl':
            return '3PL';
        case 'virtual':
            return 'Virtual';
        default:
            return type || 'Main';
    }
}

export default async function WarehouseDetailPage({ params }: PageProps) {
    const { id } = await params;
    const warehouse = await getCrmWarehouseById(id);
    if (!warehouse) notFound();

    const [summary, stockRows] = await Promise.all([
        getCrmWarehouseInventorySummary(id),
        getCrmWarehouseStockByItem(id, 50),
    ]);

    const archived = !!(warehouse as any).archived;
    const status =
        ((warehouse as any).status as string) ||
        (archived ? 'archived' : 'active');

    return (
        <EntityDetailShell
            eyebrow="WAREHOUSE"
            title={warehouse.name}
            status={{
                label: warehouse.isDefault ? 'Default' : status,
                tone: warehouse.isDefault
                    ? 'blue'
                    : statusTone(status, archived),
            }}
            back={{
                href: '/dashboard/crm/inventory/warehouses',
                label: 'Back to all warehouses',
            }}
            actions={
                <>
                    <ZoruButton variant="outline" size="sm" asChild>
                        <Link
                            href={`/dashboard/crm/inventory/warehouses/${id}/activity`}
                        >
                            <History className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Activity
                        </Link>
                    </ZoruButton>
                    <ZoruButton size="sm" asChild>
                        <Link
                            href={`/dashboard/crm/inventory/warehouses/${id}/edit`}
                        >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Edit
                        </Link>
                    </ZoruButton>
                    <WarehouseDetailActions
                        id={id}
                        isDefault={!!warehouse.isDefault}
                        archived={archived}
                    />
                </>
            }
            rightRail={
                <>
                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Related</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent className="space-y-2 text-[13px]">
                            <Link
                                href={`/dashboard/crm/inventory/adjustments?warehouseId=${id}`}
                                className="block rounded-md border border-zoru-line p-2.5 hover:bg-zoru-surface-2"
                            >
                                Stock adjustments here
                            </Link>
                            <Link
                                href={`/dashboard/crm/inventory/grn?warehouseId=${id}`}
                                className="block rounded-md border border-zoru-line p-2.5 hover:bg-zoru-surface-2"
                            >
                                GRNs to this warehouse
                            </Link>
                            <Link
                                href={`/dashboard/crm/inventory/items?warehouseId=${id}`}
                                className="block rounded-md border border-zoru-line p-2.5 hover:bg-zoru-surface-2"
                            >
                                Items with stock here
                            </Link>
                        </ZoruCardContent>
                    </ZoruCard>
                </>
            }
            audit={<EntityAuditTimeline entityKind="warehouse" entityId={id} />}
        >
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Basic</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-xs text-zinc-500">Code</dt>
                            <dd className="font-mono text-zinc-900 dark:text-zinc-100">
                                {fmt(warehouse.code)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zinc-500">Type</dt>
                            <dd>
                                <ZoruBadge variant="secondary">
                                    {typeLabel(warehouse.type)}
                                </ZoruBadge>
                            </dd>
                        </div>
                        {warehouse.gstin ? (
                            <div>
                                <dt className="text-xs text-zinc-500">GSTIN</dt>
                                <dd className="font-mono text-zinc-900 dark:text-zinc-100">
                                    {warehouse.gstin}
                                </dd>
                            </div>
                        ) : null}
                        {warehouse.isDefault ? (
                            <div>
                                <dt className="text-xs text-zinc-500">Default</dt>
                                <dd className="flex items-center gap-1.5">
                                    <BadgeCheck className="h-3.5 w-3.5 text-zoru-info" />
                                    Yes
                                </dd>
                            </div>
                        ) : null}
                    </dl>
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Address</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <dt className="text-xs text-zinc-500">Address</dt>
                            <dd className="text-zinc-900 dark:text-zinc-100">
                                {fmt(warehouse.address)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zinc-500">City</dt>
                            <dd className="text-zinc-900 dark:text-zinc-100">
                                {fmt(warehouse.city)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zinc-500">State</dt>
                            <dd className="text-zinc-900 dark:text-zinc-100">
                                {fmt(warehouse.state)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zinc-500">Country</dt>
                            <dd className="text-zinc-900 dark:text-zinc-100">
                                {fmt(warehouse.country)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zinc-500">Pincode</dt>
                            <dd className="text-zinc-900 dark:text-zinc-100">
                                {fmt(warehouse.pincode)}
                            </dd>
                        </div>
                    </dl>
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Contact</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-xs text-zinc-500">Manager</dt>
                            <dd className="text-zinc-900 dark:text-zinc-100">
                                {fmt(warehouse.managerName)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zinc-500">Phone</dt>
                            <dd className="text-zinc-900 dark:text-zinc-100">
                                {fmt(warehouse.phone)}
                            </dd>
                        </div>
                    </dl>
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Capacity</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                        <div>
                            <dt className="text-xs text-zinc-500">Units</dt>
                            <dd className="text-zinc-900 dark:text-zinc-100">
                                {(warehouse as any).capacityUnits
                                    ? Number(
                                          (warehouse as any).capacityUnits,
                                      ).toLocaleString()
                                    : '—'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zinc-500">Footprint</dt>
                            <dd className="text-zinc-900 dark:text-zinc-100">
                                {(warehouse as any).capacitySqft
                                    ? `${Number(
                                          (warehouse as any).capacitySqft,
                                      ).toLocaleString()} sqft`
                                    : '—'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zinc-500">Climate</dt>
                            <dd className="flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                                {(warehouse as any).climateControlled ? (
                                    <>
                                        <Snowflake className="h-3.5 w-3.5 text-zoru-info" />
                                        Climate-controlled
                                    </>
                                ) : (
                                    'Standard'
                                )}
                            </dd>
                        </div>
                    </dl>
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Inventory summary</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                        <div>
                            <dt className="text-xs text-zinc-500">Items</dt>
                            <dd className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                                {summary.itemsCount.toLocaleString()}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zinc-500">Total stock</dt>
                            <dd className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                                {summary.totalStock.toLocaleString()}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-zinc-500">Stock value</dt>
                            <dd className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                                {summary.totalValue.toLocaleString('en-IN', {
                                    style: 'currency',
                                    currency: 'INR',
                                    maximumFractionDigits: 0,
                                })}
                            </dd>
                        </div>
                    </dl>
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>
                        Stock by item ({stockRows.length})
                    </ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="p-0">
                    {stockRows.length === 0 ? (
                        <p className="p-4 text-sm text-zinc-500">
                            No items stocked in this warehouse yet.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-[12.5px]">
                                <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium">
                                            Item
                                        </th>
                                        <th className="px-3 py-2 text-left font-medium">
                                            SKU
                                        </th>
                                        <th className="px-3 py-2 text-right font-medium">
                                            Stock
                                        </th>
                                        <th className="px-3 py-2 text-right font-medium">
                                            Reorder pt
                                        </th>
                                        <th className="px-3 py-2 text-right font-medium">
                                            Cost / unit
                                        </th>
                                        <th className="px-3 py-2 text-right font-medium">
                                            Value
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stockRows.map((r) => {
                                        const low =
                                            typeof r.reorderPoint === 'number' &&
                                            r.reorderPoint > 0 &&
                                            r.stock <= r.reorderPoint;
                                        return (
                                            <tr
                                                key={r.productId}
                                                className="border-t border-zoru-line"
                                            >
                                                <td className="px-3 py-2">
                                                    <Link
                                                        href={`/dashboard/crm/inventory/items/${r.productId}`}
                                                        className="text-zoru-primary hover:underline"
                                                    >
                                                        {r.name}
                                                    </Link>
                                                </td>
                                                <td className="px-3 py-2 font-mono text-zoru-ink-muted">
                                                    {r.sku || '—'}
                                                </td>
                                                <td
                                                    className={[
                                                        'px-3 py-2 text-right font-mono',
                                                        r.stock <= 0
                                                            ? 'text-rose-500'
                                                            : low
                                                              ? 'text-amber-500'
                                                              : '',
                                                    ].join(' ')}
                                                >
                                                    {r.stock.toLocaleString()}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono text-zoru-ink-muted">
                                                    {typeof r.reorderPoint ===
                                                    'number'
                                                        ? r.reorderPoint
                                                        : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono text-zoru-ink-muted">
                                                    {r.costPrice
                                                        ? r.costPrice.toLocaleString(
                                                              'en-IN',
                                                              {
                                                                  maximumFractionDigits: 2,
                                                              },
                                                          )
                                                        : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono">
                                                    {r.value.toLocaleString(
                                                        'en-IN',
                                                        {
                                                            style: 'currency',
                                                            currency: 'INR',
                                                            maximumFractionDigits: 0,
                                                        },
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </ZoruCardContent>
            </ZoruCard>
        </EntityDetailShell>
    );
}
