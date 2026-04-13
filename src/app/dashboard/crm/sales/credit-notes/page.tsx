'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileMinus, LoaderCircle } from "lucide-react";
import Link from 'next/link';
import { getCreditNotes } from '@/app/actions/crm-credit-notes.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { WithId, CrmCreditNote } from '@/lib/definitions';

import { ClayButton, ClayCard } from '@/components/clay';
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
                <LoaderCircle className="h-8 w-8 animate-spin text-clay-ink-muted" />
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
                <ClayCard variant="outline" className="border-dashed">
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-clay-md bg-clay-rose-soft">
                            <FileMinus className="h-6 w-6 text-clay-rose-ink" strokeWidth={1.75} />
                        </div>
                        <h3 className="text-[15px] font-semibold text-clay-ink">Credit Notes</h3>
                        <p className="max-w-md text-[12.5px] text-clay-ink-muted">
                            Issue refunds or credits to your customers with professional credit notes.
                        </p>
                        <Link href="/dashboard/crm/sales/credit-notes/new">
                            <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                                Create First Credit Note
                            </ClayButton>
                        </Link>
                    </div>
                </ClayCard>
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
                        <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                            New Credit Note
                        </ClayButton>
                    </Link>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Recent Credit Notes</h2>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Credit Note #</TableHead>
                                <TableHead className="text-clay-ink-muted">Client</TableHead>
                                <TableHead className="text-clay-ink-muted">Date</TableHead>
                                <TableHead className="text-clay-ink-muted">Reason</TableHead>
                                <TableHead className="text-clay-ink-muted">Original Invoice #</TableHead>
                                <TableHead className="text-clay-ink-muted text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {notes.map(note => (
                                <TableRow key={note._id.toString()} className="border-clay-border">
                                    <TableCell className="font-medium text-clay-ink">{note.creditNoteNumber}</TableCell>
                                    <TableCell className="text-clay-ink">{accountsMap.get(note.accountId.toString()) || 'Unknown'}</TableCell>
                                    <TableCell className="text-clay-ink">{new Date(note.creditNoteDate).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-[12px] text-clay-ink-muted">{note.reason}</TableCell>
                                    <TableCell className="font-mono text-xs text-clay-ink">{note.originalInvoiceNumber || 'N/A'}</TableCell>
                                    <TableCell className="text-right font-medium text-clay-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: note.currency || 'INR' }).format(note.total)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}
