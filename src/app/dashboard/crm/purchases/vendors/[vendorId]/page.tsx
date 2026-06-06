import { Badge, Button, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
import {
  notFound } from 'next/navigation';
import Link from 'next/link';
import {
    Building2,
  ClipboardList,
  FileMinus,
  FileText,
  Package,
  ShoppingBag,
  Ticket,
  Wallet,
  } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { PortalLinkCopy } from '../_components/portal-link-copy';

/**
 * Vendor detail — `/dashboard/crm/purchases/vendors/[id]`
 * (P1.1B Wave 3 — Purchases rebuild · §1D.2).
 *
 * Server component lifted onto the canonical `<EntityDetailShell>`.
 * Mirrors the Accounts detail page on the customer side — profile card,
 * commercial card, identifiers, related rails (POs · Bills · Payouts ·
 * Debit notes · RFQs · Vendor bids · Items · Tickets), audit footer.
 *
 * NOTE: the route folder is `[id]` (not `[vendorId]`). The CRM_REBUILD
 * task referenced `[vendorId]` but the existing route slug is `[id]` —
 * preserving the slug avoids breaking every existing link.
 */

import {
    getCrmVendorById,
    getCrmVendorRelatedCounts,
} from '@/app/actions/crm-vendors.actions';

interface PageProps {
    params: Promise<{ vendorId: string }>;
}

interface VendorShape {
    name?: string;
    displayName?: string;
    email?: string;
    phone?: string;
    gstin?: string;
    pan?: string;
    street?: string;
    address?: string;
    country?: string;
    state?: string;
    city?: string;
    pincode?: string;
    industry?: string;
    website?: string;
    msmeNumber?: string;
    paymentTerms?: string;
    vendorType?: string;
    notes?: string;
    bankAccountDetails?: { accountName?: string; accountNumber?: string; bankName?: string; ifsc?: string };
    status?: string;
}

export default async function VendorDetailPage({ params }: PageProps) {
    const { vendorId: id } = await params;
    // Parallel fan-out — vendor record + related-counts don't share state.
    const [vendor, related] = await Promise.all([
        getCrmVendorById(id),
        getCrmVendorRelatedCounts(id),
    ]);

    if (!vendor) notFound();
    const v = vendor as unknown as VendorShape;

    const relatedItems: {
        label: string;
        count: number;
        icon: React.ReactNode;
        href: string;
    }[] = [
        {
            label: 'Purchase orders',
            count: related.purchaseOrders,
            icon: <ShoppingBag className="h-4 w-4" />,
            href: `/dashboard/crm/purchases/orders?vendorId=${id}`,
        },
        {
            label: 'Bills',
            count: related.bills,
            icon: <FileText className="h-4 w-4" />,
            href: `/dashboard/crm/purchases/expenses?vendorId=${id}`,
        },
        {
            label: 'Payouts',
            count: related.payouts,
            icon: <Wallet className="h-4 w-4" />,
            href: `/dashboard/crm/purchases/payouts?vendorId=${id}`,
        },
        {
            label: 'Debit notes',
            count: related.debitNotes,
            icon: <FileMinus className="h-4 w-4" />,
            href: `/dashboard/crm/purchases/debit-notes?vendorId=${id}`,
        },
        {
            label: 'RFQs',
            count: related.rfqs,
            icon: <ClipboardList className="h-4 w-4" />,
            href: `/dashboard/crm/purchases/rfqs?vendorId=${id}`,
        },
        {
            label: 'Vendor bids',
            count: related.vendorBids,
            icon: <ClipboardList className="h-4 w-4" />,
            href: `/dashboard/crm/purchases/vendor-bids?vendorId=${id}`,
        },
        {
            label: 'Items supplied',
            count: related.items,
            icon: <Package className="h-4 w-4" />,
            href: `/dashboard/crm/inventory/items?vendorId=${id}`,
        },
        {
            label: 'Tickets',
            count: related.tickets,
            icon: <Ticket className="h-4 w-4" />,
            href: `/dashboard/crm/sales/tickets?vendorId=${id}`,
        },
    ];

    return (
        <EntityDetailShell
            title={v.displayName || v.name || 'Vendor'}
            eyebrow="VENDOR"
            status={
                v.status
                    ? { label: v.status, tone: v.status === 'active' ? 'green' : 'neutral' }
                    : undefined
            }
            back={{
                href: '/dashboard/crm/purchases/vendors',
                label: 'All vendors',
            }}
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link
                            href={`/dashboard/crm/purchases/orders/new?vendorId=${id}`}
                        >
                            New PO
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link
                            href={`/dashboard/crm/purchases/expenses/new?vendorId=${id}`}
                        >
                            New bill
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link
                            href={`/dashboard/crm/purchases/payouts/new?vendorId=${id}`}
                        >
                            New payout
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/crm/purchases/vendors/${id}/activity`}>
                            Activity
                        </Link>
                    </Button>
                    <Button size="sm" asChild>
                        <Link href={`/dashboard/crm/purchases/vendors/${id}/edit`}>
                            Edit
                        </Link>
                    </Button>
                </div>
            }
            rightRail={
                <>
                    {/* At-a-glance commercial */}
                    <Card>
                        <CardHeader>
                            <CardTitle>At a glance</CardTitle>
                        </CardHeader>
                        <CardBody>
                            <div className="space-y-1.5 text-[12.5px]">
                                <Row label="Vendor type" value={v.vendorType} />
                                <Row label="Payment terms" value={v.paymentTerms} />
                                <Row label="Industry" value={v.industry} />
                                <Row label="Country" value={v.country} />
                            </div>
                        </CardBody>
                    </Card>

                    {/* Related rails */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Related</CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-1">
                            {relatedItems.map((item) => (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
                                >
                                    <span className="inline-flex items-center gap-2 text-[var(--st-text-secondary)]">
                                        {item.icon}
                                        {item.label}
                                    </span>
                                    <Badge variant="secondary">{item.count}</Badge>
                                </Link>
                            ))}
                        </CardBody>
                    </Card>

                    {/* Identifiers */}
                    {(v.gstin || v.pan || v.msmeNumber) ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Identifiers</CardTitle>
                            </CardHeader>
                            <CardBody>
                                <div className="space-y-1.5 text-[12.5px]">
                                    {v.gstin ? <Row label="GSTIN" value={v.gstin} /> : null}
                                    {v.pan ? <Row label="PAN" value={v.pan} /> : null}
                                    {v.msmeNumber ? (
                                        <Row label="MSME" value={v.msmeNumber} />
                                    ) : null}
                                </div>
                            </CardBody>
                        </Card>
                    ) : null}
                </>
            }
            audit={<EntityAuditTimeline entityKind="vendor" entityId={id} />}
        >
            {/* Profile */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        <Building2 className="inline h-4 w-4 mr-2 align-text-bottom" />
                        Profile
                    </CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="grid gap-4 md:grid-cols-2 text-[13px]">
                        <Row label="Vendor name" value={v.name} />
                        <Row label="Display name" value={v.displayName} />
                        <Row label="Email" value={v.email} />
                        <Row label="Phone" value={v.phone} />
                        <Row label="Industry" value={v.industry} />
                        <Row label="Website" value={v.website} />
                    </div>
                    <PortalLinkCopy vendorId={id} />
                </CardBody>
            </Card>

            {/* Address */}
            <Card>
                <CardHeader>
                    <CardTitle>Address</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="grid gap-4 md:grid-cols-2 text-[13px]">
                        <Row label="Street" value={v.street ?? v.address} />
                        <Row label="City" value={v.city} />
                        <Row label="State" value={v.state} />
                        <Row label="Country" value={v.country} />
                        <Row label="Pincode" value={v.pincode} />
                    </div>
                </CardBody>
            </Card>

            {/* Commercial */}
            <Card>
                <CardHeader>
                    <CardTitle>Commercial</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="grid gap-4 md:grid-cols-2 text-[13px]">
                        <Row label="Vendor type" value={v.vendorType} />
                        <Row label="Payment terms" value={v.paymentTerms} />
                        {v.bankAccountDetails?.bankName ? (
                            <>
                                <Row
                                    label="Bank"
                                    value={v.bankAccountDetails.bankName}
                                />
                                <Row
                                    label="Account #"
                                    value={v.bankAccountDetails.accountNumber}
                                />
                                <Row
                                    label="IFSC"
                                    value={v.bankAccountDetails.ifsc}
                                />
                            </>
                        ) : null}
                    </div>
                </CardBody>
            </Card>

            {/* Notes */}
            {v.notes ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Notes</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <p className="whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
                            {v.notes}
                        </p>
                    </CardBody>
                </Card>
            ) : null}
        </EntityDetailShell>
    );
}

function Row({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex items-baseline gap-3">
            <span className="w-32 shrink-0 text-[var(--st-text-secondary)]">{label}</span>
            <span className="text-[var(--st-text)]">{value || '—'}</span>
        </div>
    );
}
