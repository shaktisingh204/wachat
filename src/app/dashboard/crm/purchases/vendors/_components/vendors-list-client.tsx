'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Button,
  Checkbox,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  Banknote,
  Download,
  Edit,
  LoaderCircle,
  Paperclip,
  Trash2,
  Truck,
  X,
  } from 'lucide-react';

/**
 * Vendors list — client island.
 *
 * §1D experience over the legacy `crm_vendors` collection:
 *  - KPI strip (total · active types · with bank · attachments)
 *  - Search across name / email / phone / GSTIN
 *  - Vendor-type filter chip row
 *  - Table with edit/delete actions
 *  - Bulk select + bulk delete
 *  - CSV export
 *  - Confirm-delete alert
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import {
    deleteCrmVendor,
    getCrmVendors,
} from '@/app/actions/crm-vendors.actions';
import type { CrmVendor, WithId } from '@/lib/definitions';

type VendorRow = WithId<CrmVendor> & {
    bankAccountDetails?: { accountNumber?: string } | null;
    attachments?: string[];
};

function csvCell(v: unknown): string {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function downloadVendorsCsv(rows: VendorRow[]): void {
    const header = [
        'Name',
        'Email',
        'Phone',
        'Type',
        'GSTIN',
        'PAN',
        'City',
        'State',
    ].join(',');
    const lines = rows.map((v) =>
        [
            csvCell(v.name),
            csvCell(v.email),
            csvCell(v.phone),
            csvCell(v.vendorType),
            csvCell(v.gstin),
            csvCell(v.pan),
            csvCell(v.city),
            csvCell(v.state),
        ].join(','),
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vendors.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function VendorsListClient() {
    const { toast } = useZoruToast();
    const [vendors, setVendors] = React.useState<VendorRow[]>([]);
    const [isLoading, startLoading] = React.useTransition();
    const [search, setSearch] = React.useState('');
    const [typeFilter, setTypeFilter] = React.useState<string>('all');
    const [pendingDelete, setPendingDelete] = React.useState<VendorRow | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [bulkDeleting, setBulkDeleting] = React.useState(false);

    const refresh = React.useCallback(() => {
        startLoading(async () => {
            const data = (await getCrmVendors()) as VendorRow[];
            setVendors(data ?? []);
        });
    }, []);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    const types = React.useMemo(() => {
        const set = new Set<string>();
        vendors.forEach((v) => {
            if (v.vendorType) set.add(String(v.vendorType));
        });
        return Array.from(set).sort();
    }, [vendors]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return vendors.filter((v) => {
            if (typeFilter !== 'all' && (v.vendorType ?? '') !== typeFilter) return false;
            if (!q) return true;
            return (
                (v.name ?? '').toLowerCase().includes(q) ||
                (v.email ?? '').toLowerCase().includes(q) ||
                (v.phone ?? '').toLowerCase().includes(q) ||
                (v.gstin ?? '').toLowerCase().includes(q)
            );
        });
    }, [vendors, search, typeFilter]);

    const kpi = React.useMemo(() => {
        const totalActiveTypes = new Set(
            vendors
                .map((v) => (v.vendorType ?? '').toString().trim())
                .filter(Boolean),
        ).size;
        const withBank = vendors.filter(
            (v) => v.bankAccountDetails?.accountNumber,
        ).length;
        const withAttachments = vendors.filter(
            (v) => Array.isArray(v.attachments) && v.attachments.length > 0,
        ).length;
        return {
            total: vendors.length,
            types: totalActiveTypes,
            withBank,
            withAttachments,
        };
    }, [vendors]);

    const handleDelete = (vendorId: string) => {
        startDeleteTransition(async () => {
            const res = await deleteCrmVendor(vendorId);
            if (res.success) {
                toast({ title: 'Vendor deleted.' });
                setPendingDelete(null);
                setSelected((prev) => {
                    const n = new Set(prev);
                    n.delete(vendorId);
                    return n;
                });
                refresh();
            } else {
                toast({
                    title: 'Error',
                    description: res.error ?? 'Could not delete vendor.',
                    variant: 'destructive',
                });
            }
        });
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        setBulkDeleting(true);
        let ok = 0;
        let failed = 0;
        for (const id of ids) {
            try {
                const r = await deleteCrmVendor(id);
                if (r.success) ok += 1;
                else failed += 1;
            } catch {
                failed += 1;
            }
        }
        setBulkDeleting(false);
        setSelected(new Set());
        toast({
            title: 'Bulk delete',
            description: `${ok} removed${failed ? `, ${failed} failed` : ''}.`,
            variant: failed ? 'destructive' : undefined,
        });
        refresh();
    };

    const toggleAll = () => {
        setSelected((prev) =>
            prev.size === filtered.length
                ? new Set()
                : new Set(filtered.map((v) => String(v._id))),
        );
    };
    const toggleOne = (id: string) => {
        setSelected((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    };

    return (
        <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard
                    label="Total vendors"
                    value={kpi.total}
                    icon={<Truck className="h-4 w-4" />}
                />
                <StatCard
                    label="Vendor types"
                    value={kpi.types}
                    icon={<Truck className="h-4 w-4" />}
                />
                <StatCard
                    label="With bank details"
                    value={kpi.withBank}
                    icon={<Banknote className="h-4 w-4" />}
                />
                <StatCard
                    label="With attachments"
                    value={kpi.withAttachments}
                    icon={<Paperclip className="h-4 w-4" />}
                />
            </div>

            <EntityListShell
                title=""
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: 'Search vendors…',
                }}
                filters={
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <ZoruSelectTrigger className="h-9 w-[200px]">
                            <ZoruSelectValue placeholder="Vendor type" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">All types</ZoruSelectItem>
                            {types.map((t) => (
                                <ZoruSelectItem key={t} value={t}>
                                    {t}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </Select>
                }
                bulkBar={
                    selected.size > 0 ? (
                        <div className="flex flex-wrap items-center gap-2 text-[13px]">
                            <span className="font-medium text-zoru-ink">
                                {selected.size} selected
                            </span>
                            <span className="text-zoru-ink-muted">·</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={bulkDeleting}
                                onClick={handleBulkDelete}
                            >
                                <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                                Delete
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                    downloadVendorsCsv(
                                        filtered.filter((v) =>
                                            selected.has(String(v._id)),
                                        ),
                                    )
                                }
                            >
                                <Download className="h-3.5 w-3.5" />
                                Export CSV
                            </Button>
                            <span className="ml-auto" />
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelected(new Set())}
                            >
                                <X className="h-3.5 w-3.5" />
                                Clear
                            </Button>
                        </div>
                    ) : null
                }
                loading={isLoading && vendors.length === 0}
            >
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <Table>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="w-10">
                                    <Checkbox
                                        checked={
                                            filtered.length > 0 &&
                                            selected.size === filtered.length
                                        }
                                        onCheckedChange={toggleAll}
                                        aria-label="Select all vendors"
                                    />
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Vendor name
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Email
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Phone
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Type
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    GSTIN
                                </ZoruTableHead>
                                <ZoruTableHead className="text-right text-zoru-ink-muted">
                                    Actions
                                </ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading && vendors.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={7} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : filtered.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={7}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        {vendors.length === 0
                                            ? 'No vendors yet. Add one to start tracking suppliers.'
                                            : 'No vendors match this filter.'}
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                filtered.map((v) => {
                                    const id = String(v._id);
                                    return (
                                        <ZoruTableRow key={id} className="border-zoru-line">
                                            <ZoruTableCell>
                                                <Checkbox
                                                    checked={selected.has(id)}
                                                    onCheckedChange={() => toggleOne(id)}
                                                    aria-label={`Select ${v.name}`}
                                                />
                                            </ZoruTableCell>
                                            <ZoruTableCell className="font-medium text-zoru-ink">
                                                <EntityRowLink
                                                    href={`/dashboard/crm/purchases/vendors/${id}`}
                                                    label={v.name}
                                                    subtitle={v.email || v.phone || undefined}
                                                />
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[13px] text-zoru-ink">
                                                {v.email || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[13px] text-zoru-ink">
                                                {v.phone || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                {v.vendorType ? (
                                                    <Badge variant="ghost" className="capitalize">
                                                        {v.vendorType}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-[13px] text-zoru-ink-muted">—</span>
                                                )}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[12.5px] font-mono text-zoru-ink">
                                                {v.gstin || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link
                                                        href={`/dashboard/crm/purchases/vendors/${id}/edit`}
                                                        aria-label={`Edit ${v.name}`}
                                                    >
                                                        <Edit className="h-4 w-4 text-zoru-ink-muted" />
                                                    </Link>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setPendingDelete(v)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                                                </Button>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })
                            )}
                        </ZoruTableBody>
                    </Table>
                </div>
            </EntityListShell>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete vendor?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Are you sure you want to delete &ldquo;{pendingDelete?.name}&rdquo;?
                            Related purchase orders / bills will keep referencing the deleted id.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={() =>
                                pendingDelete && handleDelete(String(pendingDelete._id))
                            }
                            disabled={deletePending}
                        >
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
