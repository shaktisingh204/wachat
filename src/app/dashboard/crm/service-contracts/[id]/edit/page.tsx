import { notFound } from 'next/navigation';

import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getServiceContractById } from '@/app/actions/crm-service-contracts.actions';
import { ServiceContractEditForm } from './edit-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

function fmtDate(value?: string): string {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(value: unknown, currency?: string): string {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency || 'INR',
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `${currency ?? 'INR'} ${value}`;
    }
}

export default async function ServiceContractEditPage({ params }: PageProps) {
    const { id } = await params;
    const c = await getServiceContractById(id);
    if (!c) notFound();

    const status = String(c.status ?? 'active');

    return (
        <EntityDetailShell
            eyebrow="SERVICE CONTRACT"
            title={`Edit · ${c.contractNo || c.title || 'service contract'}`}
            back={{
                href: `/dashboard/crm/service-contracts/${id}`,
                label: 'Back to contract',
            }}
            status={{
                label: status,
                tone:
                    status === 'active'
                        ? 'green'
                        : status === 'closed' || status === 'expired'
                          ? 'red'
                          : status === 'paused'
                            ? 'amber'
                            : 'neutral',
            }}
            rightRail={
                <>
                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Contract</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-1.5 text-[12.5px]">
                                <div className="flex justify-between">
                                    <span className="text-zoru-ink-muted">Customer</span>
                                    <span className="truncate">
                                        {c.customerName || '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zoru-ink-muted">Value</span>
                                    <span className="font-mono tabular-nums">
                                        {fmtMoney(c.billingAmount, c.currency)}
                                    </span>
                                </div>
                                <div className="flex justify-between border-t border-zoru-line pt-2">
                                    <span className="text-zoru-ink-muted">Starts</span>
                                    <span>{fmtDate(c.periodStart ?? c.startDate)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zoru-ink-muted">Ends</span>
                                    <span>{fmtDate(c.periodEnd ?? c.endDate)}</span>
                                </div>
                            </div>
                        </ZoruCardContent>
                    </ZoruCard>
                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>People</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-1.5 text-[12.5px]">
                                <div>
                                    <div className="text-zoru-ink-muted">Technician</div>
                                    <div className="text-zoru-ink">
                                        {c.technician || '—'}
                                    </div>
                                </div>
                                <div className="border-t border-zoru-line pt-2">
                                    <div className="text-zoru-ink-muted">Account manager</div>
                                    <div className="text-zoru-ink">
                                        {c.accountManagerName || '—'}
                                    </div>
                                </div>
                            </div>
                        </ZoruCardContent>
                    </ZoruCard>
                </>
            }
            audit={<EntityAuditTimeline entityKind="service_contract" entityId={id} />}
        >
            <ServiceContractEditForm
                contract={{ ...c, _id: String(c._id ?? id) }}
            />
        </EntityDetailShell>
    );
}
