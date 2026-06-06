import React from "react";
/**
 * /portal/client/tickets/[id] — Ticket detail with reply thread.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getClientTicketById } from '@/app/actions/client-portal.actions';
import { Badge } from '@/components/sabcrm/20ui/compat';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';
import { TicketReplyForm } from '@/components/client-portal/ticket-reply-form';
import { cn } from '@/components/sabcrm/20ui/compat';

function fmtDateTime(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString();
}

async function ClientTicketDetailPageContent({
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
            <Link href="/portal/client/tickets" className="self-start text-sm text-[var(--st-text-secondary)] hover:underline">
                ← Back to tickets
            </Link>

            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                        <CardTitle>{ticket.subject}</CardTitle>
                        <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
                            #{ticket.number ?? ticket._id.slice(-6).toUpperCase()} · Opened {fmtDateTime(ticket.createdAt)}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">{ticket.priority}</Badge>
                        <Badge>{ticket.status}</Badge>
                    </div>
                </CardHeader>
                {ticket.description ? (
                    <CardBody>
                        <p className="whitespace-pre-wrap text-sm text-[var(--st-text)]">{ticket.description}</p>
                    </CardBody>
                ) : null}
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Conversation</CardTitle>
                </CardHeader>
                <CardBody className="flex flex-col gap-3">
                    {replies.length === 0 ? (
                        <p className="text-sm text-[var(--st-text-secondary)]">No replies yet.</p>
                    ) : (
                        replies.map((r) => (
                            <div
                                key={r._id}
                                className={cn(
                                    'rounded-[var(--st-radius-sm)] border p-3',
                                    r.isStaff
                                        ? 'border-[var(--st-border)] bg-[var(--st-bg-secondary)]'
                                        : 'border-[var(--st-text)]/20 bg-[var(--st-bg-muted)]',
                                )}
                            >
                                <div className="mb-1 flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
                                    <span className="font-medium text-[var(--st-text)]">{r.authorName}</span>
                                    <span>{fmtDateTime(r.createdAt)}</span>
                                </div>
                                <p className="whitespace-pre-wrap text-sm text-[var(--st-text)]">{r.message}</p>
                            </div>
                        ))
                    )}
                </CardBody>
            </Card>

            {!closed ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Add a reply</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <TicketReplyForm ticketId={ticket._id} />
                    </CardBody>
                </Card>
            ) : (
                <Card>
                    <CardBody className="text-sm text-[var(--st-text-secondary)]">
                        This ticket is closed. Open a new ticket if you need further help.
                    </CardBody>
                </Card>
            )}
        </div>
    );
}


export default function ClientTicketDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <ClientTicketDetailPageContent params={params} />
    </React.Suspense>
  );
}
