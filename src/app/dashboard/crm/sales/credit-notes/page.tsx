'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileMinus, LoaderCircle } from "lucide-react";
import Link from 'next/link';
import { getCreditNotes } from '@/app/actions/crm-credit-notes.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { WithId, CrmCreditNote } from '@/lib/definitions';

import {
    ZoruButton,
    ZoruCard,
    ZoruTable,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default function CreditNotesPage() {
    const [notes, setNotes] = useState<WithId<CrmCreditNote>[]>([]);
    const [accountsMap, setAccountsMap] = useState<Map<string, string>>(new Map());
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [notesData, accountsData] = await Promise.all([
                getCreditNotes(),
                getCrmAccounts()
            ]);
            setNotes(notesData.notes);
            const newMap = new Map(accountsData.accounts.map(acc => [acc._id.toString(), acc.name]));
            setAccountsMap(newMap);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading && notes.length === 0) {
        return (
            <div className="flex justify-center items-center h-full">
                <LoaderCircle className="h-8 w-8 animate-spin text-zoru-ink-muted" />
            </div>
        );
    }

    if (!isLoading && notes.length === 0) {
        return (
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    title="Credit Notes"
                    subtitle="Issue refunds or credits to your customers with professional credit notes."
                    icon={FileMinus}
                />
                <ZoruCard className="p-6 border-dashed">
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zoru-surface-2">
                            <FileMinus className="h-6 w-6 text-zoru-ink" strokeWidth={1.75} />
                        </div>
                        <h3 className="text-[15px] text-zoru-ink">Credit Notes</h3>
                        <p className="max-w-md text-[12.5px] text-zoru-ink-muted">
                            Issue refunds or credits to your customers with professional credit notes.
                        </p>
                        <Link href="/dashboard/crm/sales/credit-notes/new">
                            <ZoruButton>
                                <Plus className="h-4 w-4" strokeWidth={1.75} />
                                Create First Credit Note
                            </ZoruButton>
                        </Link>
                    </div>
                </ZoruCard>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Credit Notes"
                subtitle="Manage your credit notes."
                icon={FileMinus}
                actions={
                    <Link href="/dashboard/crm/sales/credit-notes/new">
                        <ZoruButton>
                            <Plus className="h-4 w-4" strokeWidth={1.75} />
                            New Credit Note
                        </ZoruButton>
                    </Link>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] text-zoru-ink">Recent Credit Notes</h2>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Credit Note #</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Client</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Date</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Reason</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Original Invoice #</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">Amount</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {notes.map(note => (
                                <ZoruTableRow key={note._id.toString()} className="border-zoru-line">
                                    <ZoruTableCell className="text-zoru-ink">{note.creditNoteNumber}</ZoruTableCell>
                                    <ZoruTableCell className="text-zoru-ink">{accountsMap.get(note.accountId.toString()) || 'Unknown'}</ZoruTableCell>
                                    <ZoruTableCell className="text-zoru-ink">{new Date(note.creditNoteDate).toLocaleDateString()}</ZoruTableCell>
                                    <ZoruTableCell className="text-[12px] text-zoru-ink-muted">{note.reason}</ZoruTableCell>
                                    <ZoruTableCell className="font-mono text-xs text-zoru-ink">{note.originalInvoiceNumber || 'N/A'}</ZoruTableCell>
                                    <ZoruTableCell className="text-right text-zoru-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: note.currency || 'INR' }).format(note.total)}</ZoruTableCell>
                                </ZoruTableRow>
                            ))}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    );
}
