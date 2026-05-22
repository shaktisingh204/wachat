/**
 * /portal/client/tickets — Support ticket list with "New Ticket" drawer.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { getClientTickets } from '@/app/actions/client-portal.actions';
import { Badge } from '@/components/zoruui/badge';
import {
    Card,
    ZoruCardContent,
} from '@/components/zoruui/card';
import {
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui/table';
import { EmptyState } from '@/components/zoruui/empty-state';
import { NewTicketDrawer } from '@/components/client-portal/new-ticket-drawer';

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

export default async function ClientTicketsPage() {
    const tickets = await getClientTickets();

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-zoru-ink">Support Tickets</h1>
                    <p className="text-sm text-zoru-ink-muted">
                        Submit and track requests from your account team.
                    </p>
                </div>
                <NewTicketDrawer />
            </div>

            {tickets.length === 0 ? (
                <EmptyState
                    title="No tickets yet"
                    description="Open a new ticket to get help from our team."
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
                                    <ZoruTableRow key={t._id}>
                                        <ZoruTableCell className="text-xs text-zoru-ink-muted">
                                            {t.number ?? t._id.slice(-6).toUpperCase()}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <Link
                                                href={`/portal/client/tickets/${t._id}`}
                                                className="font-medium text-zoru-ink hover:underline"
                                            >
                                                {t.subject}
                                            </Link>
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
