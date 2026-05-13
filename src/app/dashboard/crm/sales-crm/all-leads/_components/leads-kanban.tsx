'use client';

/**
 * <LeadsKanban> — read-mostly board grouped by stage (or status when
 * the lead has no stage). Drag-and-drop is intentionally deferred
 * to Phase 1D specialised-views (see TODO below).
 */

import * as React from 'react';
import Link from 'next/link';
import { Building, Mail } from 'lucide-react';

import { ZoruCard } from '@/components/zoruui';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { CrmLead, WithId } from '@/lib/definitions';

interface LeadsKanbanProps {
    leads: WithId<CrmLead>[];
}

function formatMoney(value: number | undefined, currency: string | undefined): string {
    const ccy = currency || 'INR';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: ccy,
            maximumFractionDigits: 0,
        }).format(value ?? 0);
    } catch {
        return `${ccy} ${(value ?? 0).toLocaleString('en-IN')}`;
    }
}

export function LeadsKanban({ leads }: LeadsKanbanProps) {
    const groups = React.useMemo(() => {
        const byKey = new Map<string, WithId<CrmLead>[]>();
        for (const lead of leads) {
            const key = lead.stage || (lead.status as string) || 'New';
            const arr = byKey.get(key) ?? [];
            arr.push(lead);
            byKey.set(key, arr);
        }
        return Array.from(byKey.entries());
    }, [leads]);

    if (groups.length === 0) {
        return (
            <ZoruCard className="flex min-h-[240px] items-center justify-center text-sm text-zoru-ink-muted">
                No leads to plot on the board.
            </ZoruCard>
        );
    }

    return (
        <div className="flex gap-4 overflow-x-auto pb-2">
            {/* TODO 1D.4: drag-to-reschedule between columns deferred — depends on stage-update server action wiring. */}
            {groups.map(([key, rows]) => {
                const totalValue = rows.reduce((sum, l) => sum + (l.value || 0), 0);
                const currency = rows[0]?.currency || 'INR';
                return (
                    <div
                        key={key}
                        className="flex w-72 shrink-0 flex-col gap-2 rounded-lg border border-zoru-line bg-zoru-surface-2 p-3"
                    >
                        <header className="flex items-center justify-between">
                            <StatusPill label={key} tone={statusToTone(key)} />
                            <span className="text-[11.5px] text-zoru-ink-muted">
                                {rows.length} • {formatMoney(totalValue, currency)}
                            </span>
                        </header>
                        <ol className="flex flex-col gap-2">
                            {rows.map((lead) => (
                                <li key={String(lead._id)}>
                                    <Link
                                        href={`/dashboard/crm/sales-crm/all-leads/${String(lead._id)}`}
                                        className="block rounded-md border border-zoru-line bg-zoru-bg p-2.5 transition-colors hover:border-zoru-line-strong"
                                    >
                                        <div className="text-[13px] font-medium text-zoru-ink line-clamp-1">
                                            {lead.title || lead.contactName || 'Untitled'}
                                        </div>
                                        <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-zoru-ink-muted">
                                            {lead.company ? (
                                                <span className="inline-flex items-center gap-1">
                                                    <Building className="h-3 w-3" />
                                                    {lead.company}
                                                </span>
                                            ) : null}
                                            {lead.email ? (
                                                <span className="inline-flex items-center gap-1 truncate">
                                                    <Mail className="h-3 w-3" />
                                                    <span className="truncate">{lead.email}</span>
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="mt-2 flex items-center justify-between text-[11.5px]">
                                            <span className="font-mono text-zoru-ink">
                                                {formatMoney(lead.value, lead.currency)}
                                            </span>
                                            <span className="text-zoru-ink-muted">
                                                {(lead as any).leadScore != null
                                                    ? `Score ${(lead as any).leadScore}`
                                                    : ''}
                                            </span>
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ol>
                    </div>
                );
            })}
        </div>
    );
}

export default LeadsKanban;
