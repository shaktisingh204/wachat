import { ZoruBadge, ZoruCard, ZoruInput, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
import { getDebitNotes } from '@/app/actions/crm-debit-notes.actions';

import { Plus, Search, FileMinus } from 'lucide-react';
import Link from 'next/link';

import { format } from 'date-fns';

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
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-[13px] font-medium text-white hover:bg-foreground/90"
                    >
                        <Plus className="h-4 w-4" strokeWidth={1.75} />
                        New Debit Note
                    </Link>
                }
            />

            <ZoruCard>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] font-semibold text-foreground">All Debit Notes</h2>
                        <p className="mt-0.5 text-[12.5px] text-muted-foreground">Showing {notes.length} of {total} notes</p>
                    </div>
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <ZoruInput
                            type="search"
                            placeholder="Search debit notes..."
                            className="h-10 rounded-lg border-border bg-card pl-9 text-[13px]"
                            defaultValue={query}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Note #</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Vendor</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Reason</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Amount</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {notes.length === 0 ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={7} className="h-24 text-center text-[13px] text-muted-foreground">
                                        No debit notes found.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                notes.map((note) => (
                                    <ZoruTableRow key={note._id.toString()} className="border-border">
                                        <ZoruTableCell className="font-medium text-foreground">{note.noteNumber}</ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-foreground">{format(new Date(note.noteDate), 'PP')}</ZoruTableCell>
                                        <ZoruTableCell>
                                            <span className="text-[12.5px] italic text-muted-foreground">Vendor {note.vendorId.toString().slice(-4)}</span>
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <ZoruBadge variant={(note.status === 'Applied' ? 'green' : 'rose-soft') as any}>
                                                {note.status}
                                            </ZoruBadge>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="max-w-[150px] truncate text-[13px] text-foreground" title={note.reason}>
                                            {note.reason || '-'}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[13px] text-foreground">
                                            {note.currency} {note.total.toFixed(2)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <Link
                                                href={`/dashboard/crm/purchases/debit-notes/${note._id}`}
                                                className="text-[12.5px] font-medium text-foreground hover:underline"
                                            >
                                                View
                                            </Link>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    );
}
