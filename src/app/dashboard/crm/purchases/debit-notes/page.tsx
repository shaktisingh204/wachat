import { getDebitNotes } from '@/app/actions/crm-debit-notes.actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, FileMinus } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

import { ClayCard, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default async function DebitNotesPage({
    searchParams,
}: {
    searchParams?: Promise<{
        query?: string;
        page?: string;
    }>;
}) {
    const params = await searchParams;
    const query = params?.query || '';
    const currentPage = Number(params?.page) || 1;
    const { notes, total } = await getDebitNotes(currentPage, 20, query);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Debit Notes"
                subtitle="Manage vendor returns and adjustments."
                icon={FileMinus}
                actions={
                    <Link
                        href="/dashboard/crm/purchases/debit-notes/new"
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-clay-obsidian px-4 text-[13px] font-medium text-white hover:bg-clay-obsidian-hover"
                    >
                        <Plus className="h-4 w-4" strokeWidth={1.75} />
                        New Debit Note
                    </Link>
                }
            />

            <ClayCard>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] font-semibold text-clay-ink">All Debit Notes</h2>
                        <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">Showing {notes.length} of {total} notes</p>
                    </div>
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-ink-muted" />
                        <Input
                            type="search"
                            placeholder="Search debit notes..."
                            className="h-10 rounded-clay-md border-clay-border bg-clay-surface pl-9 text-[13px]"
                            defaultValue={query}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Note #</TableHead>
                                <TableHead className="text-clay-ink-muted">Date</TableHead>
                                <TableHead className="text-clay-ink-muted">Vendor</TableHead>
                                <TableHead className="text-clay-ink-muted">Status</TableHead>
                                <TableHead className="text-clay-ink-muted">Reason</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Amount</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {notes.length === 0 ? (
                                <TableRow className="border-clay-border">
                                    <TableCell colSpan={7} className="h-24 text-center text-[13px] text-clay-ink-muted">
                                        No debit notes found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                notes.map((note) => (
                                    <TableRow key={note._id.toString()} className="border-clay-border">
                                        <TableCell className="font-medium text-clay-ink">{note.noteNumber}</TableCell>
                                        <TableCell className="text-[13px] text-clay-ink">{format(new Date(note.noteDate), 'PP')}</TableCell>
                                        <TableCell>
                                            <span className="text-[12.5px] italic text-clay-ink-muted">Vendor {note.vendorId.toString().slice(-4)}</span>
                                        </TableCell>
                                        <TableCell>
                                            <ClayBadge tone={note.status === 'Applied' ? 'green' : 'rose-soft'}>
                                                {note.status}
                                            </ClayBadge>
                                        </TableCell>
                                        <TableCell className="max-w-[150px] truncate text-[13px] text-clay-ink" title={note.reason}>
                                            {note.reason || '-'}
                                        </TableCell>
                                        <TableCell className="text-right text-[13px] text-clay-ink">
                                            {note.currency} {note.total.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Link
                                                href={`/dashboard/crm/purchases/debit-notes/${note._id}`}
                                                className="text-[12.5px] font-medium text-clay-ink hover:underline"
                                            >
                                                View
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}
