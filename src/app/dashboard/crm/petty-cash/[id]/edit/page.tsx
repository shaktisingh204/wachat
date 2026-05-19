import { notFound } from 'next/navigation';

import { ZoruCard, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getPettyCashFloatById } from '@/app/actions/crm-petty-cash.actions';
import { PettyCashEditForm } from './edit-form';

interface PageProps {
    params: Promise<{ id: string }>;
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

export default async function PettyCashEditPage({ params }: PageProps) {
    const { id } = await params;
    const float = await getPettyCashFloatById(id);
    if (!float) notFound();

    const balance = float.balance ?? float.currentBalance ?? 0;

    return (
        <EntityDetailShell
            eyebrow="PETTY CASH"
            title={`Edit · ${float.name || 'petty cash float'}`}
            back={{
                href: `/dashboard/crm/petty-cash/${id}`,
                label: 'Back to float',
            }}
            status={
                float.status
                    ? {
                          label: String(float.status),
                          tone:
                              float.status === 'active'
                                  ? 'green'
                                  : float.status === 'closed'
                                    ? 'red'
                                    : 'amber',
                      }
                    : undefined
            }
            rightRail={
                <>
                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Balance</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-1.5 text-[12.5px]">
                                <div className="flex justify-between">
                                    <span className="text-zoru-ink-muted">Current</span>
                                    <span className="font-mono tabular-nums">
                                        {fmtMoney(balance, float.currency)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zoru-ink-muted">Opening</span>
                                    <span className="font-mono tabular-nums">
                                        {fmtMoney(float.openingBalance, float.currency)}
                                    </span>
                                </div>
                            </div>
                        </ZoruCardContent>
                    </ZoruCard>
                    <ZoruCard>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Custody</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-1.5 text-[12.5px]">
                                <div>
                                    <div className="text-zoru-ink-muted">Custodian</div>
                                    <div className="text-zoru-ink">
                                        {float.custodianName || '—'}
                                    </div>
                                </div>
                                <div className="border-t border-zoru-line pt-2">
                                    <div className="text-zoru-ink-muted">Branch</div>
                                    <div className="text-zoru-ink">
                                        {float.branchName || '—'}
                                    </div>
                                </div>
                                {float.approverName ? (
                                    <div className="border-t border-zoru-line pt-2">
                                        <div className="text-zoru-ink-muted">Approver</div>
                                        <div className="text-zoru-ink">{float.approverName}</div>
                                    </div>
                                ) : null}
                            </div>
                        </ZoruCardContent>
                    </ZoruCard>
                </>
            }
            audit={<EntityAuditTimeline entityKind="petty_cash" entityId={id} />}
        >
            <PettyCashEditForm float={{ ...float, _id: String(float._id ?? id) }} />
        </EntityDetailShell>
    );
}
