'use client';

import { ZoruCard, useZoruToast } from '@/components/zoruui';
import { Building, GripVertical, Mail } from 'lucide-react';

/**
 * <LeadsKanban> — board grouped by stage (or status when the lead has
 * no stage). Native HTML5 drag-and-drop wires cards into columns and
 * commits the move via `updateCrmLeadStage` (or `changeCrmLeadStatus`
 * when the lead lives on the status axis).
 *
 * Optimistic update model:
 *   1. user drops → local groups are mutated immediately
 *   2. server action runs inside `startTransition`
 *   3. on RustApiError / generic failure → groups revert + toast
 *
 * No external DnD lib is pulled in — `dataTransfer` carries the lead id
 * as `text/plain`, the column listens for `dragenter`/`dragover`/`drop`.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import {
    changeCrmLeadStatus,
    updateCrmLeadStage,
} from '@/app/actions/crm-leads.actions';
import type { CrmLead, WithId } from '@/lib/definitions';

interface LeadsKanbanProps {
    leads: WithId<CrmLead>[];
    /** Optional refresher invoked after a successful drop. */
    onAfterMove?: () => void;
}

const KNOWN_STATUSES = new Set([
    'New',
    'Contacted',
    'Qualified',
    'Unqualified',
    'Converted',
    'Won',
    'Lost',
    'archived',
]);

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

interface KanbanGroup {
    key: string;
    /** When true the key represents a status pill not a pipeline stage. */
    fromStatus: boolean;
    rows: WithId<CrmLead>[];
}

function buildGroups(leads: WithId<CrmLead>[]): KanbanGroup[] {
    const byKey = new Map<string, KanbanGroup>();
    for (const lead of leads) {
        const stage = (lead.stage ?? '').trim();
        const status = ((lead.status as string) ?? 'New').trim() || 'New';
        const key = stage || status;
        const fromStatus = !stage;
        let g = byKey.get(key);
        if (!g) {
            g = { key, fromStatus, rows: [] };
            byKey.set(key, g);
        }
        g.rows.push(lead);
    }
    return Array.from(byKey.values());
}

export function LeadsKanban({ leads, onAfterMove }: LeadsKanbanProps) {
    const { toast } = useZoruToast();
    const [optimistic, setOptimistic] = React.useState<WithId<CrmLead>[]>(leads);
    const [busyId, setBusyId] = React.useState<string | null>(null);
    const [dragOverKey, setDragOverKey] = React.useState<string | null>(null);
    const [isPending, startTransition] = React.useTransition();

    React.useEffect(() => {
        setOptimistic(leads);
    }, [leads]);

    const groups = React.useMemo(() => buildGroups(optimistic), [optimistic]);

    const handleDrop = React.useCallback(
        (targetKey: string, fromStatus: boolean) => {
            setDragOverKey(null);
            const transferId = currentDragId.current;
            currentDragId.current = null;
            if (!transferId) return;
            const lead = optimistic.find((l) => String(l._id) === transferId);
            if (!lead) return;
            const currentKey = (lead.stage ?? '').trim() || (lead.status as string);
            if (currentKey === targetKey) return;

            const before = optimistic;
            const next = optimistic.map((l) =>
                String(l._id) === transferId
                    ? fromStatus
                        ? ({ ...l, status: targetKey } as WithId<CrmLead>)
                        : ({ ...l, stage: targetKey } as WithId<CrmLead>)
                    : l,
            );
            setOptimistic(next);
            setBusyId(transferId);

            startTransition(async () => {
                try {
                    const res = fromStatus
                        ? await changeCrmLeadStatus(transferId, targetKey)
                        : await updateCrmLeadStage(transferId, targetKey);
                    if (!res.success) throw new Error(res.error || 'Move failed');
                    toast({
                        title: 'Lead moved',
                        description: `Moved to ${targetKey}.`,
                    });
                    onAfterMove?.();
                } catch (e) {
                    setOptimistic(before);
                    toast({
                        title: 'Move failed',
                        description: e instanceof Error ? e.message : 'Unknown error',
                        variant: 'destructive',
                    });
                } finally {
                    setBusyId(null);
                }
            });
        },
        [optimistic, onAfterMove, toast],
    );

    // We use a ref because `dataTransfer` is unreliable in some browsers
    // and we control the source ourselves.
    const currentDragId = React.useRef<string | null>(null);

    if (groups.length === 0) {
        return (
            <ZoruCard className="flex min-h-[240px] items-center justify-center text-sm text-zoru-ink-muted">
                No leads to plot on the board.
            </ZoruCard>
        );
    }

    return (
        <div className="flex gap-4 overflow-x-auto pb-2">
            {groups.map((group) => {
                const totalValue = group.rows.reduce((sum, l) => sum + (l.value || 0), 0);
                const currency = group.rows[0]?.currency || 'INR';
                const isActiveDrop = dragOverKey === group.key;
                return (
                    <div
                        key={group.key}
                        onDragEnter={(e) => {
                            e.preventDefault();
                            setDragOverKey(group.key);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                        }}
                        onDragLeave={() => {
                            setDragOverKey((prev) => (prev === group.key ? null : prev));
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            handleDrop(group.key, group.fromStatus);
                        }}
                        className={[
                            'flex w-72 shrink-0 flex-col gap-2 rounded-lg border p-3 transition-colors',
                            isActiveDrop
                                ? 'border-zoru-primary bg-zoru-primary/5'
                                : 'border-zoru-line bg-zoru-surface-2',
                        ].join(' ')}
                    >
                        <header className="flex items-center justify-between">
                            <StatusPill label={group.key} tone={statusToTone(group.key)} />
                            <span className="text-[11.5px] text-zoru-ink-muted">
                                {group.rows.length} • {formatMoney(totalValue, currency)}
                            </span>
                        </header>
                        <ol className="flex flex-col gap-2">
                            {group.rows.map((lead) => {
                                const id = String(lead._id);
                                const isBusy = busyId === id || (isPending && busyId === id);
                                return (
                                    <li
                                        key={id}
                                        draggable
                                        onDragStart={(e) => {
                                            currentDragId.current = id;
                                            e.dataTransfer.effectAllowed = 'move';
                                            try {
                                                e.dataTransfer.setData('text/plain', id);
                                            } catch {
                                                // Some browsers throw on setData mid-drag — non-fatal.
                                            }
                                        }}
                                        onDragEnd={() => {
                                            currentDragId.current = null;
                                            setDragOverKey(null);
                                        }}
                                        className={[
                                            'group block rounded-md border border-zoru-line bg-zoru-bg p-2.5 transition-all',
                                            isBusy
                                                ? 'opacity-50'
                                                : 'hover:border-zoru-line-strong active:cursor-grabbing',
                                            'cursor-grab',
                                        ].join(' ')}
                                        aria-grabbed={isBusy ? 'true' : 'false'}
                                    >
                                        <div className="flex items-start gap-2">
                                            <GripVertical
                                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zoru-ink-subtle opacity-0 transition-opacity group-hover:opacity-100"
                                                aria-hidden
                                            />
                                            <Link
                                                href={`/dashboard/crm/sales-crm/all-leads/${id}`}
                                                className="block min-w-0 flex-1"
                                                onClick={(e) => {
                                                    // Clicking when a drag is starting can mis-fire — only allow when no drag is active.
                                                    if (currentDragId.current) e.preventDefault();
                                                }}
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
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                );
            })}
        </div>
    );
}

export default LeadsKanban;
