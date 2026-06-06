import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Table, THead, TBody, Tr, Th, Td, Skeleton } from '@/components/sabcrm/20ui/compat';
import { Suspense } from 'react';
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
                    <Button variant="outline" size="sm" asChild>
                        <Link
                            href={`/dashboard/crm/inventory/warehouses/${id}/activity`}
                        >
                            <History className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Activity
                        </Link>
                    </Button>
                    <Button size="sm" asChild>
                        <Link
                            href={`/dashboard/crm/inventory/warehouses/${id}/edit`}
                        >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                            Edit
                        </Link>
                    </Button>
                    <WarehouseDetailActions
                        id={id}
                        isDefault={!!warehouse.isDefault}
                        archived={archived}
                    />
                </>
            }
            rightRail={
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Related</CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-2 text-[13px]">
                            <Link
                                href={`/dashboard/crm/inventory/adjustments?warehouseId=${id}`}
                                className="block rounded-md border border-[var(--st-border)] p-2.5 hover:bg-[var(--st-bg-muted)]"
                            >
                                Stock adjustments here
                            </Link>
                            <Link
                                href={`/dashboard/crm/inventory/grn?warehouseId=${id}`}
                                className="block rounded-md border border-[var(--st-border)] p-2.5 hover:bg-[var(--st-bg-muted)]"
                            >
                                GRNs to this warehouse
                            </Link>
                            <Link
                                href={`/dashboard/crm/inventory/items?warehouseId=${id}`}
                                className="block rounded-md border border-[var(--st-border)] p-2.5 hover:bg-[var(--st-bg-muted)]"
                            >
                                Items with stock here
                            </Link>
                        </CardBody>
                    </Card>
                </>
            }
            audit={<EntityAuditTimeline entityKind="warehouse" entityId={id} />}
        >
            <Card>
                <CardHeader>
                    <CardTitle>Basic</CardTitle>
                </CardHeader>
                <CardBody>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Code</dt>
                            <dd className="font-mono text-[var(--st-text)] dark:text-white">
                                {fmt(warehouse.code)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Type</dt>
                            <dd>
                                <Badge variant="secondary">
                                    {typeLabel(warehouse.type)}
                                </Badge>
                            </dd>
                        </div>
                        {warehouse.gstin ? (
                            <div>
                                <dt className="text-xs text-[var(--st-text)]">GSTIN</dt>
                                <dd className="font-mono text-[var(--st-text)] dark:text-white">
                                    {warehouse.gstin}
                                </dd>
                            </div>
                        ) : null}
                        {warehouse.isDefault ? (
                            <div>
                                <dt className="text-xs text-[var(--st-text)]">Default</dt>
                                <dd className="flex items-center gap-1.5">
                                    <BadgeCheck className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                                    Yes
                                </dd>
                            </div>
                        ) : null}
                    </dl>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Address</CardTitle>
                </CardHeader>
                <CardBody>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <dt className="text-xs text-[var(--st-text)]">Address</dt>
                            <dd className="text-[var(--st-text)] dark:text-white">
                                {fmt(warehouse.address)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">City</dt>
                            <dd className="text-[var(--st-text)] dark:text-white">
                                {fmt(warehouse.city)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">State</dt>
                            <dd className="text-[var(--st-text)] dark:text-white">
                                {fmt(warehouse.state)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Country</dt>
                            <dd className="text-[var(--st-text)] dark:text-white">
                                {fmt(warehouse.country)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Pincode</dt>
                            <dd className="text-[var(--st-text)] dark:text-white">
                                {fmt(warehouse.pincode)}
                            </dd>
                        </div>
                    </dl>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Contact</CardTitle>
                </CardHeader>
                <CardBody>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Manager</dt>
                            <dd className="text-[var(--st-text)] dark:text-white">
                                {fmt(warehouse.managerName)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Phone</dt>
                            <dd className="text-[var(--st-text)] dark:text-white">
                                {fmt(warehouse.phone)}
                            </dd>
                        </div>
                    </dl>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Capacity</CardTitle>
                </CardHeader>
                <CardBody>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Units</dt>
                            <dd className="text-[var(--st-text)] dark:text-white" suppressHydrationWarning>
                                {(warehouse as any).capacityUnits
                                    ? Number(
                                          (warehouse as any).capacityUnits,
                                      ).toLocaleString()
                                    : '—'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Footprint</dt>
                            <dd className="text-[var(--st-text)] dark:text-white" suppressHydrationWarning>
                                {(warehouse as any).capacitySqft
                                    ? `${Number(
                                          (warehouse as any).capacitySqft,
                                      ).toLocaleString()} sqft`
                                    : '—'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[var(--st-text)]">Climate</dt>
                            <dd className="flex items-center gap-1.5 text-[var(--st-text)] dark:text-white">
                                {(warehouse as any).climateControlled ? (
                                    <>
                                        <Snowflake className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                                        Climate-controlled
                                    </>
                                ) : (
                                    'Standard'
                                )}
                            </dd>
                        </div>
                    </dl>
                </CardBody>
            </Card>

            <Suspense fallback={
                <Card>
                    <CardHeader><CardTitle>Inventory summary</CardTitle></CardHeader>
                    <CardBody><Skeleton className="h-16 w-full" /></CardBody>
                </Card>
            }>
                <InventorySummaryCard id={id} />
            </Suspense>

            <Suspense fallback={
                <Card>
                    <CardHeader><CardTitle>Stock by item</CardTitle></CardHeader>
                    <CardBody><Skeleton className="h-[300px] w-full" /></CardBody>
                </Card>
            }>
                <StockByItemCard id={id} />
            </Suspense>
        </EntityDetailShell>
    );
}

async function InventorySummaryCard({ id }: { id: string }) {
    const summary = await getCrmWarehouseInventorySummary(id);
    return (
        <Card>
            <CardHeader>
                <CardTitle>Inventory summary</CardTitle>
            </CardHeader>
            <CardBody>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                    <div>
                        <dt className="text-xs text-[var(--st-text)]">Items</dt>
                        <dd className="text-lg font-semibold text-[var(--st-text)] dark:text-white" suppressHydrationWarning>
                            {summary.itemsCount.toLocaleString()}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-[var(--st-text)]">Total stock</dt>
                        <dd className="text-lg font-semibold text-[var(--st-text)] dark:text-white" suppressHydrationWarning>
                            {summary.totalStock.toLocaleString()}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-[var(--st-text)]">Stock value</dt>
                        <dd className="text-lg font-semibold text-[var(--st-text)] dark:text-white" suppressHydrationWarning>
                            {summary.totalValue.toLocaleString('en-IN', {
                                style: 'currency',
                                currency: 'INR',
                                maximumFractionDigits: 0,
                            })}
                        </dd>
                    </div>
                </dl>
            </CardBody>
        </Card>
    );
}

async function StockByItemCard({ id }: { id: string }) {
    const stockRows = await getCrmWarehouseStockByItem(id, 50);
    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    Stock by item ({stockRows.length})
                </CardTitle>
            </CardHeader>
            <CardBody className="p-0">
                {stockRows.length === 0 ? (
                    <p className="p-4 text-sm text-[var(--st-text)]">
                        No items stocked in this warehouse yet.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <Table className="w-full text-[12.5px]">
                            <THead className="bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                                <Tr>
                                    <Th className="px-3 py-2 text-left font-medium">
                                        Item
                                    </Th>
                                    <Th className="px-3 py-2 text-left font-medium">
                                        SKU
                                    </Th>
                                    <Th className="px-3 py-2 text-right font-medium">
                                        Stock
                                    </Th>
                                    <Th className="px-3 py-2 text-right font-medium">
                                        Reorder pt
                                    </Th>
                                    <Th className="px-3 py-2 text-right font-medium">
                                        Cost / unit
                                    </Th>
                                    <Th className="px-3 py-2 text-right font-medium">
                                        Value
                                    </Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {stockRows.map((r) => {
                                    const low =
                                        typeof r.reorderPoint === 'number' &&
                                        r.reorderPoint > 0 &&
                                        r.stock <= r.reorderPoint;
                                    return (
                                        <Tr
                                            key={r.productId}
                                            className="border-t border-[var(--st-border)]"
                                        >
                                            <Td className="px-3 py-2">
                                                <Link
                                                    href={`/dashboard/crm/inventory/items/${r.productId}`}
                                                    className="text-[var(--st-text)] hover:underline"
                                                >
                                                    {r.name}
                                                </Link>
                                            </Td>
                                            <Td className="px-3 py-2 font-mono text-[var(--st-text-secondary)]">
                                                {r.sku || '—'}
                                            </Td>
                                            <Td
                                                className={[
                                                    'px-3 py-2 text-right font-mono',
                                                    r.stock <= 0
                                                        ? 'text-[var(--st-text)]'
                                                        : low
                                                          ? 'text-[var(--st-text)]'
                                                          : '',
                                                ].join(' ')}
                                                suppressHydrationWarning
                                            >
                                                {r.stock.toLocaleString()}
                                            </Td>
                                            <Td className="px-3 py-2 text-right font-mono text-[var(--st-text-secondary)]" suppressHydrationWarning>
                                                {typeof r.reorderPoint ===
                                                'number'
                                                    ? r.reorderPoint
                                                    : '—'}
                                            </Td>
                                            <Td className="px-3 py-2 text-right font-mono text-[var(--st-text-secondary)]" suppressHydrationWarning>
                                                {r.costPrice
                                                    ? r.costPrice.toLocaleString(
                                                          'en-IN',
                                                          {
                                                              maximumFractionDigits: 2,
                                                          },
                                                      )
                                                    : '—'}
                                            </Td>
                                            <Td className="px-3 py-2 text-right font-mono" suppressHydrationWarning>
                                                {r.value.toLocaleString(
                                                    'en-IN',
                                                    {
                                                        style: 'currency',
                                                        currency: 'INR',
                                                        maximumFractionDigits: 0,
                                                    },
                                                )}
                                            </Td>
                                        </Tr>
                                    );
                                })}
                            </TBody>
                        </Table>
                    </div>
                )}
            </CardBody>
        </Card>
    );
}
