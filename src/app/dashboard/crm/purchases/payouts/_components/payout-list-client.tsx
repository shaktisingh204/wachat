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
import { MoreHorizontal, Pencil, Trash2, CheckCircle2, XCircle, FileText } from 'lucide-react';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { setPayoutStatus } from '@/app/actions/crm/payouts.actions';
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';
import type { CrmPayoutDoc } from '@/lib/rust-client/crm-payouts';

interface PayoutListClientProps {
    payouts: CrmPayoutDoc[];
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

function modeLabel(mode: string | undefined): string {
    if (!mode) return '—';
    const map: Record<string, string> = {
        cash: 'Cash',
        cheque: 'Cheque',
        upi: 'UPI',
        neft: 'NEFT',
        rtgs: 'RTGS',
        imps: 'IMPS',
        card: 'Card',
        wallet: 'Wallet',
    };
    return map[mode] ?? mode;
}

export function PayoutListClient({
    payouts,
    loading,
    selectedIds,
    onToggleOne,
    onToggleAll,
    onDelete,
}: PayoutListClientProps) {
    const { toast } = useZoruToast();
    const router = useRouter();

    const bulky = useCrmBulkyState<CrmPayoutDoc>({
        initialData: payouts,
    });

    React.useEffect(() => {
        bulky.setData(payouts);
    }, [payouts]);

    const handleSaveInlineEdit = async (id: string, updatedFields: Partial<CrmPayoutDoc>) => {
        if (!updatedFields.status) return;
        try {
            const res = await setPayoutStatus(id, updatedFields.status as any);
            if (res.success) {
                toast({ title: 'Saved inline', description: `Payout status updated to ${updatedFields.status}.` });
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

    const columns = React.useMemo<ColumnDef<CrmPayoutDoc>[]>(() => [
        {
            key: 'paymentNo',
            header: 'Payment #',
            sortable: true,
            render: (row) => {
                const id = String(row._id);
                const refLabel = row.chequeNo || row.txnId || row.reference || '—';
                return (
                    <EntityRowLink
                        href={`/dashboard/crm/purchases/payouts/${id}`}
                        label={row.paymentNo || id.slice(-6)}
                        subtitle={refLabel !== '—' ? refLabel : undefined}
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
                <span className="text-[var(--st-text-secondary)]">—</span>
            ),
        },
        {
            key: 'date',
            header: 'Date',
            sortable: true,
            render: (row) => (
                <span className="text-[var(--st-text-secondary)]">{fmtDate(row.date)}</span>
            ),
        },
        {
            key: 'mode',
            header: 'Mode',
            sortable: true,
            render: (row) => (
                <Badge variant="outline">{modeLabel(row.mode)}</Badge>
            ),
        },
        {
            key: 'bankAccountId',
            header: 'Bank',
            sortable: true,
            render: (row) => row.bankAccountId ? (
                <EntityPickerChip entity="bankAccount" id={row.bankAccountId} />
            ) : (
                <span className="text-[var(--st-text-secondary)]">—</span>
            ),
        },
        {
            key: 'reference',
            header: 'Cheque / Ref',
            render: (row) => {
                const refLabel = row.chequeNo || row.txnId || row.reference || '—';
                return <span className="text-[var(--st-text-secondary)]">{refLabel}</span>;
            },
        },
        {
            key: 'amount',
            header: 'Amount',
            sortable: true,
            render: (row) => (
                <span className="font-mono tabular-nums text-[var(--st-text)] text-right block w-full">
                    {fmtMoney(row.amount, row.currency)}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            sortable: true,
            render: (row) => {
                const status = row.status || 'sent';
                return <StatusPill label={status} tone={statusToTone(status)} />;
            },
            editRender: (row, value, onChange) => (
                <select
                    className="bg-[var(--st-bg-muted)] border border-[var(--st-border)] rounded px-1.5 py-0.5 text-xs text-[var(--st-text)] focus:outline-none"
                    value={value || 'sent'}
                    onChange={(e) => onChange(e.target.value)}
                >
                    <option value="sent">Sent</option>
                    <option value="cleared">Cleared</option>
                    <option value="failed">Failed</option>
                </select>
            ),
        },
        {
            key: 'applied',
            header: 'Applied',
            render: (row) => {
                const appliedCount = row.applyTo?.length ?? 0;
                return appliedCount > 0 ? (
                    <Badge variant="secondary">
                        <FileText className="mr-1 h-3 w-3" /> {appliedCount}
                    </Badge>
                ) : (
                    <span className="text-[var(--st-text-secondary)]">—</span>
                );
            },
        },
        {
            key: 'actions',
            header: '',
            render: (row) => {
                const id = String(row._id);
                return (
                    <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" asChild>
                            <Link href={`/dashboard/crm/purchases/payouts/${id}/edit`}>
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
                                    setPayoutStatus(id, 'cleared').then(res => {
                                        if (res.success) {
                                            toast({ title: 'Marked cleared' });
                                            router.refresh();
                                        } else {
                                            toast({ title: 'Update failed', description: res.error, variant: 'destructive' });
                                        }
                                    });
                                }}>
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                    Mark cleared
                                </ZoruDropdownMenuItem>
                                <ZoruDropdownMenuItem onClick={() => {
                                    setPayoutStatus(id, 'failed').then(res => {
                                        if (res.success) {
                                            toast({ title: 'Marked failed' });
                                            router.refresh();
                                        } else {
                                            toast({ title: 'Update failed', description: res.error, variant: 'destructive' });
                                        }
                                    });
                                }}>
                                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                    Mark failed
                                </ZoruDropdownMenuItem>
                                <ZoruDropdownMenuSeparator />
                                <ZoruDropdownMenuItem onClick={() => onDelete(id)} className="text-[var(--st-danger)]">
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
        <CrmBulkyGrid<CrmPayoutDoc>
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
