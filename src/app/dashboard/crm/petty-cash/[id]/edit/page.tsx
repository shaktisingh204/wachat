import { notFound } from 'next/navigation';

import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/sabcrm/20ui/compat';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getPettyCashFloatById } from '@/app/actions/crm-petty-cash.actions';
import { PettyCashEditForm } from './edit-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

import { fmtINR as fmtMoney } from '@/lib/utils';

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
                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Balance</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-1.5 text-[12.5px]">
                                <div className="flex justify-between">
                                    <span className="text-[var(--st-text-secondary)]">Current</span>
                                    <span className="font-mono tabular-nums">
                                        {fmtMoney(balance, float.currency)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[var(--st-text-secondary)]">Opening</span>
                                    <span className="font-mono tabular-nums">
                                        {fmtMoney(float.openingBalance, float.currency)}
                                    </span>
                                </div>
                            </div>
                        </ZoruCardContent>
                    </Card>
                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Custody</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-1.5 text-[12.5px]">
                                <div>
                                    <div className="text-[var(--st-text-secondary)]">Custodian</div>
                                    <div className="text-[var(--st-text)]">
                                        {float.custodianName || '—'}
                                    </div>
                                </div>
                                <div className="border-t border-[var(--st-border)] pt-2">
                                    <div className="text-[var(--st-text-secondary)]">Branch</div>
                                    <div className="text-[var(--st-text)]">
                                        {float.branchName || '—'}
                                    </div>
                                </div>
                                {float.approverName ? (
                                    <div className="border-t border-[var(--st-border)] pt-2">
                                        <div className="text-[var(--st-text-secondary)]">Approver</div>
                                        <div className="text-[var(--st-text)]">{float.approverName}</div>
                                    </div>
                                ) : null}
                            </div>
                        </ZoruCardContent>
                    </Card>
                </>
            }
            audit={<EntityAuditTimeline entityKind="petty_cash" entityId={id} />}
        >
            <PettyCashEditForm float={{ ...float, _id: String(float._id ?? id) }} />
        </EntityDetailShell>
    );
}
