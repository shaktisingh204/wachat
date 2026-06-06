import React from "react";
/**
 * /portal/client/tickets — Support ticket list with "New Ticket" drawer.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { getClientTickets } from '@/app/actions/client-portal.actions';
import { Badge } from '@/components/sabcrm/20ui/compat';
import {
    Card,
    ZoruCardContent,
} from '@/components/sabcrm/20ui/compat';
import {
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/sabcrm/20ui/compat';
import { EmptyState } from '@/components/sabcrm/20ui/compat';
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
                    <h1 className="text-2xl font-semibold text-zoru-ink">Support Tickets</h1>
                    <p className="text-sm text-zoru-ink-muted">
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
                    <ZoruCardContent className="p-0">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>#</ZoruTableHead>
                                    <ZoruTableHead>Subject</ZoruTableHead>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                    <ZoruTableHead>Priority</ZoruTableHead>
                                    <ZoruTableHead>Last Reply</ZoruTableHead>
                                    <ZoruTableHead>Created</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {tickets.map((t) => (
                                    <ZoruTableRow key={t._id} className={t.awaitingClientResponse ? "bg-zoru-surface-2/30" : ""}>
                                        <ZoruTableCell className="text-xs text-zoru-ink-muted">
                                            {t.number ?? t._id.slice(-6).toUpperCase()}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <div className="flex flex-col gap-1.5 items-start">
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        href={`/portal/client/tickets/${t._id}`}
                                                        className="font-medium text-zoru-ink hover:underline"
                                                    >
                                                        {t.subject}
                                                    </Link>
                                                    {t.awaitingClientResponse && (
                                                        <span className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-zoru-surface-2 text-zoru-ink">
                                                            Action Required
                                                        </span>
                                                    )}
                                                </div>
                                                <SlaIndicator dueBy={t.dueBy || null} status={t.status} />
                                            </div>
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                                        </ZoruTableCell>
                                        <ZoruTableCell>{t.priority}</ZoruTableCell>
                                        <ZoruTableCell>{fmtDate(t.lastReplyAt)}</ZoruTableCell>
                                        <ZoruTableCell>{fmtDate(t.createdAt)}</ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </Table>
                    </ZoruCardContent>
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
