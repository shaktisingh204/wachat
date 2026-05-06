'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Receipt, LoaderCircle, FileMinus, Pencil, Save } from "lucide-react";
import Link from 'next/link';
import { getInvoices, updateInvoice } from '@/app/actions/crm-invoices.actions';
import { convertInvoiceToCreditNote } from '@/app/actions/crm-services.actions';
import type { WithId, CrmInvoice } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';

import {
    ZoruAlertDialog,
    ZoruAlertDialogAction,
    ZoruAlertDialogCancel,
    ZoruAlertDialogContent,
    ZoruAlertDialogDescription,
    ZoruAlertDialogFooter,
    ZoruAlertDialogHeader,
    ZoruAlertDialogTitle,
    ZoruAlertDialogTrigger,
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruDialog,
    ZoruDialogContent,
    ZoruDialogDescription,
    ZoruDialogFooter,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruInput,
    ZoruLabel,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruTable,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    ZoruTextarea,
    useZoruToast,
} from '@/components/zoruui';
import { SharePublicLinkButton } from '@/components/worksuite/share-public-link-button';
import { CrmPageHeader } from '../../_components/crm-page-header';

const INVOICE_STATUSES = ['Draft', 'Sent', 'Paid', 'Overdue', 'Partially Paid', 'Cancelled'];

function toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(value as any);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<WithId<CrmInvoice>[]>([]);
    const [accountsMap, setAccountsMap] = useState<Map<string, string>>(new Map());
    const [isLoading, startTransition] = useTransition();
    const [convertingId, setConvertingId] = useState<string | null>(null);
    const [editing, setEditing] = useState<WithId<CrmInvoice> | null>(null);
    const [editForm, setEditForm] = useState({
        invoiceNumber: '',
        invoiceDate: '',
        dueDate: '',
        status: 'Draft',
        notes: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();
    const { toast } = useZoruToast();

    const openEdit = (invoice: WithId<CrmInvoice>) => {
        setEditing(invoice);
        setEditForm({
            invoiceNumber: invoice.invoiceNumber || '',
            invoiceDate: toDateInput(invoice.invoiceDate),
            dueDate: toDateInput((invoice as any).dueDate),
            status: invoice.status || 'Draft',
            notes: invoice.notes || '',
        });
    };

    const saveEdit = async () => {
        if (!editing) return;
        setIsSaving(true);
        const res = await updateInvoice(editing._id.toString(), {
            invoiceNumber: editForm.invoiceNumber,
            invoiceDate: editForm.invoiceDate || undefined,
            dueDate: editForm.dueDate || null,
            status: editForm.status,
            notes: editForm.notes,
        });
        setIsSaving(false);
        if (res.success) {
            toast({ title: 'Invoice updated' });
            setEditing(null);
            fetchData();
        } else {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
        }
    };

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [invoicesData, accountsData] = await Promise.all([
                getInvoices(),
                getCrmAccounts()
            ]);
            setInvoices(invoicesData.invoices);
            const newMap = new Map(accountsData.accounts.map(acc => [acc._id.toString(), acc.name]));
            setAccountsMap(newMap);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleConvert = async (invoiceId: string) => {
        setConvertingId(invoiceId);
        const res = await convertInvoiceToCreditNote(invoiceId);
        setConvertingId(null);
        if (res.success && res.creditNoteId) {
            toast({
                title: 'Converted',
                description: 'Credit note created from invoice.',
            });
            router.push(`/dashboard/crm/sales/credit-notes`);
        } else {
            toast({
                title: 'Error',
                description: res.error || 'Failed to convert invoice.',
                variant: 'destructive',
            });
        }
    };

    const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'ghost' => {
        const s = status.toLowerCase();
        if (s === 'paid') return 'success';
        if (s === 'sent') return 'warning';
        if (s === 'overdue') return 'danger';
        return 'ghost';
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Invoices"
                subtitle="Create and manage your sales invoices."
                icon={Receipt}
                actions={
                    <Link href="/dashboard/crm/sales/invoices/new">
                        <ZoruButton>
                            <Plus className="h-4 w-4" strokeWidth={1.75} />
                            New Invoice
                        </ZoruButton>
                    </Link>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] text-zoru-ink">Recent Invoices</h2>
                    <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">A list of invoices you have created.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Invoice #</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Client</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Date</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Due Date</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">Amount</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right w-[180px]">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={7} className="text-center h-24">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : invoices.length > 0 ? (
                                invoices.map(q => {
                                    const invoiceId = q._id.toString();
                                    const isConverting = convertingId === invoiceId;
                                    return (
                                    <ZoruTableRow key={invoiceId} className="border-zoru-line">
                                        <ZoruTableCell className="text-zoru-ink">{q.invoiceNumber}</ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">{accountsMap.get(q.accountId.toString()) || 'Unknown Client'}</ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">{new Date(q.invoiceDate).toLocaleDateString()}</ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">{q.dueDate ? new Date(q.dueDate).toLocaleDateString() : 'N/A'}</ZoruTableCell>
                                        <ZoruTableCell><ZoruBadge variant={getStatusVariant(q.status)}>{q.status}</ZoruBadge></ZoruTableCell>
                                        <ZoruTableCell className="text-right text-zoru-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: q.currency || 'INR' }).format(q.total)}</ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <span className="mr-2 inline-block align-middle">
                                                <SharePublicLinkButton
                                                    resourceType="invoice"
                                                    resourceId={invoiceId}
                                                />
                                            </span>
                                            <ZoruButton
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openEdit(q)}
                                                className="mr-2"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                                Edit
                                            </ZoruButton>
                                            <ZoruAlertDialog>
                                                <ZoruAlertDialogTrigger asChild>
                                                    <ZoruButton
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={isConverting}
                                                    >
                                                        {isConverting ? (
                                                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <FileMinus className="h-3.5 w-3.5" />
                                                        )}
                                                        Credit Note
                                                    </ZoruButton>
                                                </ZoruAlertDialogTrigger>
                                                <ZoruAlertDialogContent>
                                                    <ZoruAlertDialogHeader>
                                                        <ZoruAlertDialogTitle className="text-zoru-ink">Convert to Credit Note?</ZoruAlertDialogTitle>
                                                        <ZoruAlertDialogDescription className="text-zoru-ink-muted">
                                                            This will create a new draft credit note from invoice {q.invoiceNumber}. The original invoice will remain unchanged.
                                                        </ZoruAlertDialogDescription>
                                                    </ZoruAlertDialogHeader>
                                                    <ZoruAlertDialogFooter>
                                                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                                        <ZoruAlertDialogAction onClick={() => handleConvert(invoiceId)}>
                                                            Convert
                                                        </ZoruAlertDialogAction>
                                                    </ZoruAlertDialogFooter>
                                                </ZoruAlertDialogContent>
                                            </ZoruAlertDialog>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                    );
                                })
                            ) : (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={7} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                                        No invoices found.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>

            <ZoruDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
                <ZoruDialogContent className="sm:max-w-md">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle className="text-zoru-ink">Edit Invoice</ZoruDialogTitle>
                        <ZoruDialogDescription className="text-zoru-ink-muted">
                            Update invoice number, dates, status, and notes.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="edit-inv-num" className="text-zoru-ink">Invoice #</ZoruLabel>
                            <ZoruInput
                                id="edit-inv-num"
                                value={editForm.invoiceNumber}
                                onChange={(e) => setEditForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="edit-inv-date" className="text-zoru-ink">Invoice Date</ZoruLabel>
                                <ZoruInput
                                    id="edit-inv-date"
                                    type="date"
                                    value={editForm.invoiceDate}
                                    onChange={(e) => setEditForm(f => ({ ...f, invoiceDate: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <ZoruLabel htmlFor="edit-due-date" className="text-zoru-ink">Due Date</ZoruLabel>
                                <ZoruInput
                                    id="edit-due-date"
                                    type="date"
                                    value={editForm.dueDate}
                                    onChange={(e) => setEditForm(f => ({ ...f, dueDate: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="edit-status" className="text-zoru-ink">Status</ZoruLabel>
                            <ZoruSelect
                                value={editForm.status}
                                onValueChange={(value) => setEditForm(f => ({ ...f, status: value }))}
                            >
                                <ZoruSelectTrigger id="edit-status">
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {INVOICE_STATUSES.map(s => (
                                        <ZoruSelectItem key={s} value={s}>{s}</ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="edit-notes" className="text-zoru-ink">Notes</ZoruLabel>
                            <ZoruTextarea
                                id="edit-notes"
                                rows={3}
                                value={editForm.notes}
                                onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))}
                            />
                        </div>
                    </div>
                    <ZoruDialogFooter>
                        <ZoruButton variant="outline" onClick={() => setEditing(null)} disabled={isSaving}>
                            Cancel
                        </ZoruButton>
                        <ZoruButton
                            onClick={saveEdit}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Save Changes
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>
        </div>
    );
}
