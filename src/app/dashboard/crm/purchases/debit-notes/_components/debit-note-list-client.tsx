'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { MoreHorizontal, Trash2, Pencil, BadgeDollarSign } from 'lucide-react';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { setDebitNoteStatus } from '@/app/actions/crm/debit-notes.actions';
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';
import type { CrmDebitNoteDoc } from '@/lib/rust-client/crm-debit-notes';

interface DebitNoteListClientProps {
    debitNotes: CrmDebitNoteDoc[];
    loading: boolean;
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (all: boolean) => void;
    onDelete: (id: string) => void;
}

function fmtMoney(value?: number, currency?: string): string {
    if (typeof value !== 'number') return '—';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency || 'INR',
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `${currency || 'INR'} ${value}`;
    }
}

function fmtDate(v?: string): string {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function reasonLabel(reason?: string): string {
    if (!reason) return '—';
    const map: Record<string, string> = {
        return: 'Return',
        discount: 'Discount',
        price_adjust: 'Price adj.',
        cancel: 'Cancellation',
        other: 'Other',
    };
    return map[reason] ?? reason;
}

function refundModeLabel(mode?: string): string {
    if (!mode) return '—';
    const map: Record<string, string> = {
        cash: 'Cash',
        credit: 'Credit',
        replacement: 'Replacement',
    };
    return map[mode] ?? mode;
}

export function DebitNoteListClient({
    debitNotes,
    loading,
    selectedIds,
    onToggleOne,
    onToggleAll,
    onDelete,
}: DebitNoteListClientProps) {
    const { toast } = useZoruToast();
    const router = useRouter();

    const bulky = useCrmBulkyState<CrmDebitNoteDoc>({
        initialData: debitNotes,
    });

    React.useEffect(() => {
        bulky.setData(debitNotes);
    }, [debitNotes]);

    const handleSaveInlineEdit = async (id: string, updatedFields: Partial<CrmDebitNoteDoc>) => {
        if (!updatedFields.status) return;
        try {
            const res = await setDebitNoteStatus(id, updatedFields.status as any);
            if (res.success) {
                toast({ title: 'Saved inline', description: `Debit Note status updated to ${updatedFields.status}.` });
                bulky.cancelInlineEdit();
                router.refresh();
            } else {
                toast({
                    title: 'Update failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        } catch (err: any) {
            toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
        }
    };

    const columns = React.useMemo<ColumnDef<CrmDebitNoteDoc>[]>(() => [
        {
            key: 'dnNo',
            header: 'DN #',
            sortable: true,
            render: (row) => {
                const id = String(row._id);
                return (
                    <EntityRowLink
                        href={`/dashboard/crm/purchases/debit-notes/${id}`}
                        label={row.dnNo || id.slice(-6)}
                        subtitle={row.linkedBillId ? `Bill ${row.linkedBillId.slice(-6)}` : undefined}
                    />
                );
            },
        },
        {
            key: 'vendorId',
            header: 'Vendor',
            sortable: true,
            render: (row) => row.vendorId ? (
                <EntityPickerChip entity="vendor" id={row.vendorId} />
            ) : (
                <span className="text-zoru-ink-muted">—</span>
            ),
        },
        {
            key: 'linkedBillId',
            header: 'Linked bill',
            sortable: true,
            render: (row) => row.linkedBillId ? (
                <Link
                    href={`/dashboard/crm/purchases/expenses/${row.linkedBillId}`}
                    className="hover:underline font-mono text-zoru-ink"
                >
                    {row.linkedBillId.slice(-8)}
                </Link>
            ) : (
                <span className="text-zoru-ink-muted">—</span>
            ),
        },
        {
            key: 'date',
            header: 'Date',
            sortable: true,
            render: (row) => (
                <span className="text-zoru-ink-muted">{fmtDate(row.date)}</span>
            ),
        },
        {
            key: 'reason',
            header: 'Reason',
            sortable: true,
            render: (row) => (
                <Badge variant="outline">
                    {reasonLabel(row.reason)}
                </Badge>
            ),
        },
        {
            key: 'amount',
            header: 'Amount',
            sortable: true,
            render: (row) => (
                <span className="font-mono tabular-nums text-zoru-ink text-right block w-full">
                    {fmtMoney(row.totals?.total, row.currency)}
                </span>
            ),
        },
        {
            key: 'refundMode',
            header: 'Refund mode',
            sortable: true,
            render: (row) => (
                <span className="text-zoru-ink-muted">{refundModeLabel(row.refundMode)}</span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (row) => {
                const status = row.status || 'draft';
                return <StatusPill label={status} tone={statusToTone(status)} />;
            },
            editRender: (row, value, onChange) => (
                <select
                    className="bg-zoru-surface-2 border border-zoru-line rounded px-1.5 py-0.5 text-xs text-zoru-ink focus:outline-none"
                    value={value || 'draft'}
                    onChange={(e) => onChange(e.target.value)}
                >
                    <option value="draft">Draft</option>
                    <option value="issued">Issued</option>
                    <option value="refunded">Refunded</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            ),
        },
        {
            key: 'actions',
            header: '',
            render: (row) => {
                const id = String(row._id);
                return (
                    <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" asChild>
                            <Link href={`/dashboard/crm/purchases/debit-notes/${id}/edit`}>
                                <Pencil className="h-3.5 w-3.5" />
                            </Link>
                        </Button>
                        <DropdownMenu>
                            <ZoruDropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                            </ZoruDropdownMenuTrigger>
                            <ZoruDropdownMenuContent align="end">
                                <ZoruDropdownMenuItem onClick={() => {
                                    setDebitNoteStatus(id, 'refunded').then(res => {
                                        if (res.success) {
                                            toast({ title: 'Marked refunded' });
                                            router.refresh();
                                        } else {
                                            toast({ title: 'Update failed', description: res.error, variant: 'destructive' });
                                        }
                                    });
                                }}>
                                    <BadgeDollarSign className="h-3.5 w-3.5 mr-1.5" />
                                    Mark refunded
                                </ZoruDropdownMenuItem>
                                <ZoruDropdownMenuSeparator />
                                <ZoruDropdownMenuItem onClick={() => onDelete(id)} className="text-zoru-danger-ink">
                                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                    Delete
                                </ZoruDropdownMenuItem>
                            </ZoruDropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
        },
    ], [toast, router, onDelete]);

    return (
        <CrmBulkyGrid<CrmDebitNoteDoc>
            columns={columns}
            data={bulky.data}
            selectedIds={selectedIds}
            onSelectOne={onToggleOne}
            onSelectAll={onToggleAll}
            density="comfortable"
            inlineEditRowId={bulky.inlineEditRowId}
            editBuffer={bulky.editBuffer}
            onStartInlineEdit={bulky.startInlineEdit}
            onCancelInlineEdit={bulky.cancelInlineEdit}
            onSaveInlineEdit={handleSaveInlineEdit}
            onUpdateEditBuffer={bulky.updateEditBuffer}
            isLoading={loading}
        />
    );
}
