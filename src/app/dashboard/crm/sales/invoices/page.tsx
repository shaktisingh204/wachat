'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Receipt, LoaderCircle, FileMinus, Pencil, Save } from "lucide-react";
import Link from 'next/link';
import { getInvoices, updateInvoice } from '@/app/actions/crm-invoices.actions';
import { convertInvoiceToCreditNote } from '@/app/actions/crm-services.actions';
import type { WithId, CrmInvoice } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

import { ClayButton, ClayCard, ClayBadge } from '@/components/clay';
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
    const { toast } = useToast();

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

    const getStatusTone = (status: string): 'green' | 'amber' | 'red' | 'rose-soft' => {
        const s = status.toLowerCase();
        if (s === 'paid') return 'green';
        if (s === 'sent') return 'amber';
        if (s === 'overdue') return 'red';
        return 'rose-soft';
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Invoices"
                subtitle="Create and manage your sales invoices."
                icon={Receipt}
                actions={
                    <Link href="/dashboard/crm/sales/invoices/new">
                        <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                            New Invoice
                        </ClayButton>
                    </Link>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Recent Invoices</h2>
                    <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">A list of invoices you have created.</p>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Invoice #</TableHead>
                                <TableHead className="text-clay-ink-muted">Client</TableHead>
                                <TableHead className="text-clay-ink-muted">Date</TableHead>
                                <TableHead className="text-clay-ink-muted">Due Date</TableHead>
                                <TableHead className="text-clay-ink-muted">Status</TableHead>
                                <TableHead className="text-clay-ink-muted text-right">Amount</TableHead>
                                <TableHead className="text-clay-ink-muted text-right w-[180px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-clay-border">
                                    <TableCell colSpan={7} className="text-center h-24">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-clay-ink-muted" />
                                    </TableCell>
                                </TableRow>
                            ) : invoices.length > 0 ? (
                                invoices.map(q => {
                                    const invoiceId = q._id.toString();
                                    const isConverting = convertingId === invoiceId;
                                    return (
                                    <TableRow key={invoiceId} className="border-clay-border">
                                        <TableCell className="font-medium text-clay-ink">{q.invoiceNumber}</TableCell>
                                        <TableCell className="text-clay-ink">{accountsMap.get(q.accountId.toString()) || 'Unknown Client'}</TableCell>
                                        <TableCell className="text-clay-ink">{new Date(q.invoiceDate).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-clay-ink">{q.dueDate ? new Date(q.dueDate).toLocaleDateString() : 'N/A'}</TableCell>
                                        <TableCell><ClayBadge tone={getStatusTone(q.status)} dot>{q.status}</ClayBadge></TableCell>
                                        <TableCell className="text-right font-medium text-clay-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: q.currency || 'INR' }).format(q.total)}</TableCell>
                                        <TableCell className="text-right">
                                            <span className="mr-2 inline-block align-middle">
                                                <SharePublicLinkButton
                                                    resourceType="invoice"
                                                    resourceId={invoiceId}
                                                />
                                            </span>
                                            <ClayButton
                                                variant="pill"
                                                size="sm"
                                                onClick={() => openEdit(q)}
                                                leading={<Pencil className="h-3.5 w-3.5" />}
                                                className="mr-2"
                                            >
                                                Edit
                                            </ClayButton>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <ClayButton
                                                        variant="pill"
                                                        size="sm"
                                                        disabled={isConverting}
                                                        leading={isConverting ? (
                                                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <FileMinus className="h-3.5 w-3.5" />
                                                        )}
                                                    >
                                                        Credit Note
                                                    </ClayButton>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="text-clay-ink">Convert to Credit Note?</AlertDialogTitle>
                                                        <AlertDialogDescription className="text-clay-ink-muted">
                                                            This will create a new draft credit note from invoice {q.invoiceNumber}. The original invoice will remain unchanged.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleConvert(invoiceId)}>
                                                            Convert
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow className="border-clay-border">
                                    <TableCell colSpan={7} className="h-24 text-center text-[13px] text-clay-ink-muted">
                                        No invoices found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>

            <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-clay-ink">Edit Invoice</DialogTitle>
                        <DialogDescription className="text-clay-ink-muted">
                            Update invoice number, dates, status, and notes.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-inv-num" className="text-clay-ink">Invoice #</Label>
                            <Input
                                id="edit-inv-num"
                                value={editForm.invoiceNumber}
                                onChange={(e) => setEditForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-inv-date" className="text-clay-ink">Invoice Date</Label>
                                <Input
                                    id="edit-inv-date"
                                    type="date"
                                    value={editForm.invoiceDate}
                                    onChange={(e) => setEditForm(f => ({ ...f, invoiceDate: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-due-date" className="text-clay-ink">Due Date</Label>
                                <Input
                                    id="edit-due-date"
                                    type="date"
                                    value={editForm.dueDate}
                                    onChange={(e) => setEditForm(f => ({ ...f, dueDate: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-status" className="text-clay-ink">Status</Label>
                            <Select
                                value={editForm.status}
                                onValueChange={(value) => setEditForm(f => ({ ...f, status: value }))}
                            >
                                <SelectTrigger id="edit-status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {INVOICE_STATUSES.map(s => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-notes" className="text-clay-ink">Notes</Label>
                            <Textarea
                                id="edit-notes"
                                rows={3}
                                value={editForm.notes}
                                onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <ClayButton variant="pill" onClick={() => setEditing(null)} disabled={isSaving}>
                            Cancel
                        </ClayButton>
                        <ClayButton
                            variant="obsidian"
                            onClick={saveEdit}
                            disabled={isSaving}
                            leading={isSaving ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                        >
                            Save Changes
                        </ClayButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
