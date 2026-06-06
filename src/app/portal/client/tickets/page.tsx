import React from "react";
/**
 * /portal/client/tickets — Support ticket list with "New Ticket" drawer.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { getClientTickets } from '@/app/actions/client-portal.actions';
import { Badge } from '@/components/sabcrm/20ui';
import { Card, CardBody } from '@/components/sabcrm/20ui';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { EmptyState } from '@/components/sabcrm/20ui';
import { NewTicketDrawer } from '@/components/client-portal/new-ticket-drawer';
import { TicketFilters } from './ticket-filters';
import { SlaIndicator } from './sla-indicator';

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
}

function statusVariant(s: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    const v = s.toLowerCase();
    if (v === 'resolved' || v === 'closed') return 'secondary';
    if (v === 'open') return 'default';
    return 'outline';
}

async function ClientTicketsPageContent(props: { searchParams?: { status?: string } }) {
    const rawTickets = await getClientTickets();
    const filterStatus = props.searchParams?.status || 'all';

    const tickets = filterStatus === 'all'
        ? rawTickets
        : rawTickets.filter(t => {
            if (filterStatus === 'awaiting_client') return t.awaitingClientResponse;
            return t.status.toLowerCase() === filterStatus.toLowerCase();
        });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-[var(--st-text)]">Support Tickets</h1>
                    <p className="text-sm text-[var(--st-text-secondary)]">
                        Submit and track requests from your account team.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <TicketFilters />
                    <NewTicketDrawer />
                </div>
            </div>

            {tickets.length === 0 ? (
                <EmptyState
                    title="No tickets found"
                    description="You don't have any tickets matching the current filter."
                />
            ) : (
                <Card>
                    <CardBody className="p-0">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>#</Th>
                                    <Th>Subject</Th>
                                    <Th>Status</Th>
                                    <Th>Priority</Th>
                                    <Th>Last Reply</Th>
                                    <Th>Created</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {tickets.map((t) => (
                                    <Tr key={t._id} className={t.awaitingClientResponse ? "bg-[var(--st-bg-muted)]/30" : ""}>
                                        <Td className="text-xs text-[var(--st-text-secondary)]">
                                            {t.number ?? t._id.slice(-6).toUpperCase()}
                                        </Td>
                                        <Td>
                                            <div className="flex flex-col gap-1.5 items-start">
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        href={`/portal/client/tickets/${t._id}`}
                                                        className="font-medium text-[var(--st-text)] hover:underline"
                                                    >
                                                        {t.subject}
                                                    </Link>
                                                    {t.awaitingClientResponse && (
                                                        <span className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                                                            Action Required
                                                        </span>
                                                    )}
                                                </div>
                                                <SlaIndicator dueBy={t.dueBy || null} status={t.status} />
                                            </div>
                                        </Td>
                                        <Td>
                                            <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                                        </Td>
                                        <Td>{t.priority}</Td>
                                        <Td>{fmtDate(t.lastReplyAt)}</Td>
                                        <Td>{fmtDate(t.createdAt)}</Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </CardBody>
                </Card>
            )}
        </div>
    );
}


export default function ClientTicketsPage(props: { searchParams?: { status?: string } }) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <ClientTicketsPageContent searchParams={searchParams} />
    </React.Suspense>
  );
}
