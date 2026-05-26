/**
 * Helpers extracted from `<TicketsListClient>` to keep the parent
 * shell under the 600-line file cap.
 *
 *   • `runTicketsBulk` — fan-out runner for status/priority/assign/
 *     delete bulk ops; the Rust ticket endpoints are per-resource so we
 *     iterate client-side and tally the successes.
 *   • `exportTicketsCsv` — turns a ticket list into a downloaded CSV.
 *   • `requesterKindOf` — looks up the polymorphic requester kind from
 *     `customFields.requesterKind`.
 */

import {
    deleteTicketAction,
    updateTicket,
} from '@/app/actions/crm/tickets.actions';
import type { CrmTicketDoc } from '@/lib/rust-client/crm-tickets';

export type TicketRequesterKind = 'client' | 'lead' | 'employee';

export function requesterKindOf(t: CrmTicketDoc): TicketRequesterKind {
    const bag = (t.customFields ?? {}) as Record<string, unknown>;
    const raw = String(bag.requesterKind ?? '').toLowerCase();
    if (raw === 'lead' || raw === 'employee' || raw === 'client') return raw;
    return 'client';
}

export function exportTicketsCsv(rows: CrmTicketDoc[]): void {
    const header = [
        'ID',
        'Subject',
        'RequesterId',
        'RequesterKind',
        'Channel',
        'Category',
        'Priority',
        'Severity',
        'Status',
        'AssigneeId',
        'DueBy',
        'CreatedAt',
    ];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
        header.join(','),
        ...rows.map((t) =>
            [
                esc(t._id),
                esc(t.subject),
                esc(t.requesterId),
                esc(requesterKindOf(t)),
                esc(t.channel),
                esc(t.category),
                esc(t.priority),
                esc(t.severity),
                esc(t.status),
                esc(t.assigneeId),
                esc(t.dueBy ?? ''),
                esc(t.createdAt ?? t.audit?.createdAt ?? ''),
            ].join(','),
        ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

export type TicketsBulkOp = 'status' | 'priority' | 'assign' | 'delete';

export interface TicketsBulkResult {
    ok: number;
    failed: number;
}

export async function runTicketsBulk(
    ids: string[],
    op: TicketsBulkOp,
    payload?: string | null,
): Promise<TicketsBulkResult> {
    let ok = 0;
    let failed = 0;
    for (const id of ids) {
        try {
            if (op === 'delete') {
                const r = await deleteTicketAction(id);
                if (r.success) ok += 1;
                else failed += 1;
            } else if (op === 'status') {
                await updateTicket(id, { status: payload ?? undefined });
                ok += 1;
            } else if (op === 'priority') {
                await updateTicket(id, { priority: payload ?? undefined });
                ok += 1;
            } else if (op === 'assign') {
                await updateTicket(id, { assigneeId: payload ?? '' });
                ok += 1;
            }
        } catch (e) {
            failed += 1;
            console.error('[runTicketsBulk]', op, id, e);
        }
    }
    return { ok, failed };
}
