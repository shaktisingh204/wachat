import { ZoruBadge, ZoruCard } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import { LifeBuoy } from 'lucide-react';

/**
 * Ticket activity — `/dashboard/crm/tickets/[id]/activity` (§1D.2).
 *
 * Renders the timestamped audit + assignment + note history for the
 * ticket as a single chronological feed. Source-of-truth is the ticket
 * doc itself — `audit`, `assignment`, and `internalNotes`. A richer
 * activity-log table can swap in later without changing this page's
 * route.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { getTicket } from '@/app/actions/crm/tickets.actions';

export const dynamic = 'force-dynamic';

interface ActivityEntry {
    id: string;
    ts: string;
    label: string;
    body?: string;
    actorId?: string;
    kind: 'note' | 'system';
    tone?: React.ComponentProps<typeof ZoruBadge>['variant'];
}

function fmt(ts?: string): string {
    if (!ts) return '—';
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default async function TicketActivityPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { ticket, error } = await getTicket(id);

    if (!ticket) {
        if (error) {
            return (
                <div className="flex w-full flex-col gap-4 p-6">
                    <p className="text-[14px] text-zoru-ink">{error}</p>
                </div>
            );
        }
        notFound();
    }

    const entries: ActivityEntry[] = [];
    if (ticket.audit?.createdAt) {
        entries.push({
            id: 'created',
            ts: ticket.audit.createdAt,
            label: 'Ticket created',
            actorId: ticket.audit.createdBy,
            kind: 'system',
            tone: 'info',
        });
    }
    if (
        ticket.audit?.updatedAt &&
        ticket.audit.updatedAt !== ticket.audit.createdAt
    ) {
        entries.push({
            id: 'updated',
            ts: ticket.audit.updatedAt,
            label: 'Ticket updated',
            actorId: ticket.audit.updatedBy,
            kind: 'system',
        });
    }
    if (ticket.assignment?.assignedAt) {
        entries.push({
            id: 'assigned',
            ts: ticket.assignment.assignedAt,
            label: 'Assigned',
            actorId: ticket.assignment.assignedBy,
            kind: 'system',
            tone: 'warning',
        });
    }
    if (Array.isArray(ticket.internalNotes)) {
        for (const [idx, n] of (ticket.internalNotes as unknown[]).entries()) {
            const obj = (n ?? {}) as Record<string, unknown>;
            const body = String(obj.body ?? obj.text ?? '');
            if (!body) continue;
            entries.push({
                id: `note_${idx}`,
                ts: String(obj.createdAt ?? obj.ts ?? new Date(0).toISOString()),
                label: obj.kind === 'public' ? 'Public reply' : 'Internal note',
                body,
                actorId: obj.authorId ? String(obj.authorId) : undefined,
                kind: 'note',
                tone: obj.kind === 'public' ? 'info' : 'warning',
            });
        }
    }

    entries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    return (
        <EntityDetailShell
            eyebrow="TICKET"
            title={`Activity — ${ticket.subject || 'Ticket'}`}
            back={{ href: `/dashboard/crm/tickets/${String(ticket._id)}`, label: 'Back to ticket' }}
        >

            <ZoruCard className="p-4">
                {entries.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                        <LifeBuoy className="h-6 w-6 text-zoru-ink-muted" />
                        <p className="text-[13px] text-zoru-ink-muted">
                            No activity recorded yet.
                        </p>
                    </div>
                ) : (
                    <ol className="flex flex-col gap-3">
                        {entries.map((e) => (
                            <li
                                key={e.id}
                                className="flex gap-3 rounded-md border border-zoru-line bg-zoru-surface-2/40 p-3"
                            >
                                <div className="shrink-0">
                                    <ZoruBadge variant={e.tone ?? 'ghost'}>{e.label}</ZoruBadge>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 text-[11.5px] text-zoru-ink-muted">
                                        <span>{fmt(e.ts)}</span>
                                        {e.actorId ? (
                                            <>
                                                <span aria-hidden>·</span>
                                                <EntityPickerChip entity="user" id={e.actorId} />
                                            </>
                                        ) : null}
                                    </div>
                                    {e.body ? (
                                        <p className="mt-1 whitespace-pre-wrap text-[13px] text-zoru-ink">
                                            {e.body}
                                        </p>
                                    ) : null}
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </ZoruCard>
        </EntityDetailShell>
    );
}
