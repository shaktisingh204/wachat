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
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  useZoruToast,
  ZoruDropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
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
  Star,
  StarHalf,
  FileWarning,
  MoreHorizontal,
  ShoppingCart,
} from 'lucide-react';

/**
 * Vendors list — client island.
 *
 * Upgraded to use spreadsheet-style CrmBulkyGrid and useCrmBulkyState.
 * §1D experience over the legacy `crm_vendors` collection:
 *  - KPI strip (total · active types · with bank · attachments)
 *  - Search across name / email / phone / GSTIN
 *  - Vendor-type filter chip row
 *  - CrmBulkyGrid with inline status/type dropdown edits
 *  - Bulk select + bulk delete
 *  - CSV export
 *  - Confirm-delete alert
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';
import {
  deleteCrmVendor,
  getCrmVendors,
  patchCrmVendor,
} from '@/app/actions/crm-vendors.actions';
import type { CrmVendor, WithId } from '@/lib/definitions';
import { VendorPerformanceDashboard } from './vendor-performance-dashboard';

type VendorRow = WithId<CrmVendor> & {
  bankAccountDetails?: { accountNumber?: string } | null;
  attachments?: string[];
  complianceScore?: number; // 0 to 5
};

function StarRating({ score = 0 }: { score?: number }) {
  const fullStars = Math.floor(score);
  const halfStar = score % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

  return (
    <div className="flex items-center gap-0.5" title={`Score: ${score}/5`}>
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star key={`full-${i}`} className="h-3.5 w-3.5 fill-zoru-ink-muted text-zoru-ink-muted" />
      ))}
      {halfStar && <StarHalf className="h-3.5 w-3.5 fill-zoru-ink-muted text-zoru-ink-muted" />}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star key={`empty-${i}`} className="h-3.5 w-3.5 text-zoru-line" />
      ))}
    </div>
  );
}

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

interface VendorsListClientProps {
  initialVendors?: VendorRow[];
}

export function VendorsListClient({ initialVendors = [] }: VendorsListClientProps) {
  const { toast } = useZoruToast();
  const [vendors, setVendors] = React.useState<VendorRow[]>(initialVendors);
  const [isLoading, startLoading] = React.useTransition();
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [pendingDelete, setPendingDelete] = React.useState<VendorRow | null>(null);
  const [deletePending, startDeleteTransition] = React.useTransition();
  const [bulkDeleting, setBulkDeleting] = React.useState(false);

  const bulky = useCrmBulkyState<VendorRow>({
    initialData: vendors,
  });

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      const data = (await getCrmVendors()) as VendorRow[];
      setVendors(data ?? []);
    });
  }, []);

  React.useEffect(() => {
    if (initialVendors.length === 0) {
      refresh();
    }
  }, [refresh, initialVendors.length]);

  React.useEffect(() => {
    bulky.setData(vendors);
  }, [vendors]);

  const types = React.useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v) => {
      if (v.vendorType) set.add(String(v.vendorType));
    });
    return Array.from(set).sort();
  }, [vendors]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return bulky.data.filter((v) => {
      if (typeFilter !== 'all' && (v.vendorType ?? '') !== typeFilter) return false;
      if (!q) return true;
      return (
        (v.name ?? '').toLowerCase().includes(q) ||
        (v.email ?? '').toLowerCase().includes(q) ||
        (v.phone ?? '').toLowerCase().includes(q) ||
        (v.gstin ?? '').toLowerCase().includes(q)
      );
    });
  }, [bulky.data, search, typeFilter]);

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
        bulky.toggleSelectOne(vendorId); // remove from selection if selected
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
    const ids = Array.from(bulky.selected);
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
    bulky.clearSelection();
    toast({
      title: 'Bulk delete',
      description: `${ok} removed${failed ? `, ${failed} failed` : ''}.`,
      variant: failed ? 'destructive' : undefined,
    });
    refresh();
  };

  const handleSaveInlineEdit = async (id: string, updatedFields: Partial<VendorRow>) => {
    try {
      const res = await patchCrmVendor(id, { vendorType: updatedFields.vendorType });
      if (res.success) {
        toast({
          title: 'Saved inline',
          description: `Vendor type updated.`,
        });
        bulky.setData((prev) =>
          prev.map((row) => (row._id === id ? { ...row, ...updatedFields } : row))
        );
        bulky.cancelInlineEdit();
        refresh();
      } else {
        toast({
          title: 'Update failed',
          description: res.error || 'Unknown error occurred.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Update failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const columns = React.useMemo<ColumnDef<VendorRow>[]>(() => [
    {
      key: 'name',
      header: 'Vendor name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <EntityRowLink
            href={`/dashboard/crm/purchases/vendors/${row._id}`}
            label={row.name}
            subtitle={row.email || row.phone || undefined}
          />
          {(!row.attachments || row.attachments.length === 0) && (
            <div title="Missing compliance docs" className="text-zoru-warning-ink">
              <FileWarning className="h-4 w-4" />
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (row) => <span className="text-[13px] text-zoru-ink">{row.email || '—'}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      sortable: true,
      render: (row) => <span className="text-[13px] text-zoru-ink">{row.phone || '—'}</span>,
    },
    {
      key: 'vendorType',
      header: 'Type',
      sortable: true,
      render: (row) => (
        row.vendorType ? (
          <Badge variant="ghost" className="capitalize">
            {row.vendorType}
          </Badge>
        ) : (
          <span className="text-[13px] text-zoru-ink-muted">—</span>
        )
      ),
      editRender: (row, value, onChange) => (
        <select
          className="bg-zoru-surface-2 border border-zoru-line rounded px-1.5 py-0.5 text-xs text-zoru-ink focus:outline-none"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'gstin',
      header: 'GSTIN',
      sortable: true,
      render: (row) => <span className="text-[12.5px] font-mono text-zoru-ink">{row.gstin || '—'}</span>,
    },
    {
      key: 'health',
      header: 'Health Score',
      sortable: true,
      render: (row) => <StarRating score={row.complianceScore ?? 0} />,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild>
            <Link
              href={`/dashboard/crm/purchases/vendors/${row._id}/edit`}
              aria-label={`Edit ${row.name}`}
            >
              <Edit className="h-4 w-4 text-zoru-ink-muted" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPendingDelete(row)}
          >
            <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
          </Button>
          <ZoruDropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4 text-zoru-ink-muted" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/crm/purchases/orders/new?vendorId=${row._id}`}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Create PO
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/crm/purchases/orders?vendorId=${row._id}`}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  View POs
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </ZoruDropdownMenu>
        </div>
      ),
    },
  ], [types]);

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

      <VendorPerformanceDashboard vendors={vendors} />

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
          bulky.selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-medium text-zoru-ink">
                {bulky.selected.size} selected
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
                      bulky.selected.has(String(v._id)),
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
                onClick={bulky.clearSelection}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          ) : null
        }
        loading={isLoading && vendors.length === 0}
      >
        <div className="overflow-hidden rounded-lg border border-zoru-line bg-zoru-surface">
          <CrmBulkyGrid<VendorRow>
            columns={columns}
            data={filtered}
            selectedIds={bulky.selected}
            onSelectOne={(id) => bulky.toggleSelectOne(id)}
            onSelectAll={(checked) =>
              bulky.toggleSelectAll(
                filtered.map((d) => String(d._id)),
                checked
              )
            }
            density="comfortable"
            inlineEditRowId={bulky.inlineEditRowId}
            editBuffer={bulky.editBuffer}
            onStartInlineEdit={bulky.startInlineEdit}
            onCancelInlineEdit={bulky.cancelInlineEdit}
            onSaveInlineEdit={handleSaveInlineEdit}
            onUpdateEditBuffer={bulky.updateEditBuffer}
            isLoading={isLoading}
          />
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
