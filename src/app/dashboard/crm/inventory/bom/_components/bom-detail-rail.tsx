import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
/**
 * Right-rail for the BOM detail page. Lists sibling versions / variants
 * for the same finished good and related production orders. Pure
 * server-component — receives already-fetched data from the parent.
 */
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';

export interface BomVersionEntry {
    _id: string;
    bomNo: string;
    version: string;
    status: string;
    active?: boolean;
}

export interface BomRelatedProductionOrder {
    _id: string;
    orderNo: string;
    status: string;
    plannedQty: number;
    createdAt?: string;
}

export interface BomDetailRailProps {
    versions: BomVersionEntry[];
    productionOrders: BomRelatedProductionOrder[];
}

export function BomDetailRail({ versions, productionOrders }: BomDetailRailProps) {
    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>Versions / variants</CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                    {versions.length === 0 ? (
                        <p className="px-4 py-3 text-[12.5px] text-[var(--st-text-secondary)]">
                            No other versions for this finished good.
                        </p>
                    ) : (
                        <ul className="divide-y divide-[var(--st-border)]">
                            {versions.map((v) => (
                                <li key={v._id} className="flex items-center justify-between px-4 py-2">
                                    <Link
                                        href={`/dashboard/crm/inventory/bom/${v._id}`}
                                        className="text-[13px] text-[var(--st-text)] hover:underline"
                                    >
                                        <span className="font-mono">{v.bomNo}</span>
                                        <span className="ml-2 text-[var(--st-text-secondary)]">v{v.version}</span>
                                    </Link>
                                    <StatusPill label={v.status} tone={statusToTone(v.status)} />
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Related production orders</CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                    {productionOrders.length === 0 ? (
                        <p className="px-4 py-3 text-[12.5px] text-[var(--st-text-secondary)]">
                            No production orders yet.
                        </p>
                    ) : (
                        <ul className="divide-y divide-[var(--st-border)]">
                            {productionOrders.map((p) => (
                                <li
                                    key={p._id}
                                    className="flex items-center justify-between px-4 py-2 text-[13px]"
                                >
                                    <Link
                                        href={`/dashboard/crm/inventory/production-orders/${p._id}`}
                                        className="text-[var(--st-text)] hover:underline"
                                    >
                                        <span className="font-mono">{p.orderNo}</span>
                                        <span className="ml-2 text-[var(--st-text-secondary)]">
                                            {p.plannedQty} units
                                        </span>
                                    </Link>
                                    <StatusPill label={p.status} tone={statusToTone(p.status)} />
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}

export default BomDetailRail;
