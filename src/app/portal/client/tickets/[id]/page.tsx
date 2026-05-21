/**
 * /portal/client/tickets/[id] — Ticket detail with reply thread.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getClientTicketById } from '@/app/actions/client-portal.actions';
import { ZoruBadge } from '@/components/zoruui/badge';
import {
    ZoruCard,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui/card';
import { TicketReplyForm } from '@/components/client-portal/ticket-reply-form';
import { cn } from '@/components/zoruui/lib/cn';

function fmtDateTime(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString();
}

export default async function ClientTicketDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const data = await getClientTicketById(id);
    if (!data) notFound();
    const { ticket, replies } = data;
    const closed = ticket.status.toLowerCase() === 'closed';

    return (
        <div className="flex flex-col gap-4">
            <Link href="/portal/client/tickets" className="self-start text-sm text-zoru-ink-muted hover:underline">
                ← Back to tickets
            </Link>

            <ZoruCard>
                <ZoruCardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                        <ZoruCardTitle>{ticket.subject}</ZoruCardTitle>
                        <p className="mt-1 text-xs text-zoru-ink-muted">
                            #{ticket.number ?? ticket._id.slice(-6).toUpperCase()} · Opened {fmtDateTime(ticket.createdAt)}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <ZoruBadge variant="outline">{ticket.priority}</ZoruBadge>
                        <ZoruBadge>{ticket.status}</ZoruBadge>
                    </div>
                </ZoruCardHeader>
                {ticket.description ? (
                    <ZoruCardContent>
                        <p className="whitespace-pre-wrap text-sm text-zoru-ink">{ticket.description}</p>
                    </ZoruCardContent>
                ) : null}
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Conversation</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="flex flex-col gap-3">
                    {replies.length === 0 ? (
                        <p className="text-sm text-zoru-ink-muted">No replies yet.</p>
                    ) : (
                        replies.map((r) => (
                            <div
                                key={r._id}
                                className={cn(
                                    'rounded-[var(--zoru-radius-sm)] border p-3',
                                    r.isStaff
                                        ? 'border-zoru-line bg-zoru-surface'
                                        : 'border-zoru-primary/20 bg-zoru-surface-2',
                                )}
                            >
                                <div className="mb-1 flex items-center justify-between text-xs text-zoru-ink-muted">
                                    <span className="font-medium text-zoru-ink">{r.authorName}</span>
                                    <span>{fmtDateTime(r.createdAt)}</span>
                                </div>
                                <p className="whitespace-pre-wrap text-sm text-zoru-ink">{r.message}</p>
                            </div>
                        ))
                    )}
                </ZoruCardContent>
            </ZoruCard>

            {!closed ? (
                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Add a reply</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <TicketReplyForm ticketId={ticket._id} />
                    </ZoruCardContent>
                </ZoruCard>
            ) : (
                <ZoruCard>
                    <ZoruCardContent className="text-sm text-zoru-ink-muted">
                        This ticket is closed. Open a new ticket if you need further help.
                    </ZoruCardContent>
                </ZoruCard>
            )}
        </div>
    );
}
