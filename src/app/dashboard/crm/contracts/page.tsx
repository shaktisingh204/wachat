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
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  useActionState,
} from 'react';
import Link from 'next/link';
import {
  ListChecks,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  getContracts,
  saveContract,
  deleteContract,
} from '@/app/actions/crm-services.actions';
import type { HrContract } from '@/lib/hr-types';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import {
  ContractsKpiStrip,
  computeContractKpis,
  type ContractsKpiKey,
} from './_components/contracts-kpi-strip';
import { ContractFormDialog } from './_components/contract-form-dialog';

type Contract = HrContract & { _id: string };

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function ContractsPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<Contract[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // §1D filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [partyFilter, setPartyFilter] = useState<'all' | string>('all');
  const [expiryFilter, setExpiryFilter] = useState<
    'all' | '30d' | '60d' | '90d'
  >('all');
  const [kpiKey, setKpiKey] = useState<ContractsKpiKey>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const kpis = useMemo(() => computeContractKpis(rows as any), [rows]);

  const partyOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (!r.clientId) continue;
      map.set(String(r.clientId), r.clientName || String(r.clientId));
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const now = Date.now();
    return rows.filter((r) => {
      if (needle) {
        const hay = [r.title ?? '', r.clientName ?? '', r.status ?? '']
          .join(' ')
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (partyFilter !== 'all' && String(r.clientId) !== partyFilter)
        return false;
      if (expiryFilter !== 'all') {
        const days =
          expiryFilter === '30d' ? 30 : expiryFilter === '60d' ? 60 : 90;
        const horizon = now + days * 24 * 60 * 60 * 1000;
        const end = r.endDate ? new Date(r.endDate as any).getTime() : NaN;
        if (!Number.isFinite(end) || end < now || end > horizon) return false;
      }
      switch (kpiKey) {
        case 'draft':
          if (r.status !== 'draft') return false;
          break;
        case 'sent':
          if (r.status !== 'sent') return false;
          break;
        case 'signed':
          if (r.status !== 'signed') return false;
          break;
        case 'expiring60':
          {
            const horizon = now + 60 * 24 * 60 * 60 * 1000;
            const end = r.endDate ? new Date(r.endDate as any).getTime() : NaN;
            if (
              !Number.isFinite(end) ||
              end < now ||
              end > horizon ||
              r.status === 'terminated'
            )
              return false;
          }
          break;
      }
      return true;
    });
  }, [rows, search, statusFilter, partyFilter, expiryFilter, kpiKey]);

  const hasActiveFilters =
    !!search.trim() ||
    statusFilter !== 'all' ||
    partyFilter !== 'all' ||
    expiryFilter !== 'all' ||
    kpiKey !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPartyFilter('all');
    setExpiryFilter('all');
    setKpiKey('all');
  };

  const headChecked =
    filtered.length > 0 && filtered.every((r) => selected.has(r._id));

  const toggleAll = (all: boolean) =>
    setSelected(all ? new Set(filtered.map((r) => r._id)) : new Set());

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportCsv = () => {
    const subset =
      selected.size > 0 ? filtered.filter((r) => selected.has(r._id)) : filtered;
    const header = [
      'Title',
      'Client',
      'Type',
      'Value',
      'Currency',
      'Start',
      'End',
      'Status',
    ];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      header.join(','),
      ...subset.map((r) =>
        [
          esc(r.title),
          esc(r.clientName ?? r.clientId),
          esc((r as any).type ?? ''),
          esc(r.value ?? ''),
          esc(r.currency ?? 'INR'),
          esc(r.startDate ?? ''),
          esc(r.endDate ?? ''),
          esc(r.status ?? ''),
        ].join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contracts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runBulkDelete = async () => {
    setBulkConfirmOpen(false);
    const ids = Array.from(selected);
    let ok = 0;
    let failed = 0;
    for (const id of ids) {
      const res = await deleteContract(id);
      if (res.success) ok += 1;
      else failed += 1;
    }
    toast({
      title:
        failed === 0
          ? `${ok} contract${ok === 1 ? '' : 's'} deleted`
          : `${ok} deleted · ${failed} failed`,
      variant: failed > 0 ? 'destructive' : undefined,
    });
    setSelected(new Set());
    refresh();
  };

  const [saveState, saveFormAction, isSaving] = useActionState(saveContract, {
    message: '',
    error: '',
  } as any);

  const refresh = useCallback(() => {
    startLoading(async () => {
      const list = await getContracts();
      setRows((list as Contract[]) || []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      setDialogOpen(false);
      setEditing(null);
      refresh();
    }
    if (saveState?.error) {
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
    }
  }, [saveState, toast, refresh]);

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteContract(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Contract removed.' });
      setDeletingId(null);
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  return (
    <EntityListShell
      title="Contracts"
      subtitle="Prepare, send, and e-sign client contracts."
      primaryAction={
        <ZoruButton
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          Add Contract
          </ZoruButton>
        }
      >
      <ContractsKpiStrip counts={kpis} active={kpiKey} onPick={setKpiKey} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
          <ZoruInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, client, status…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>
        <ZoruSelect value={statusFilter} onValueChange={setStatusFilter}>
          <ZoruSelectTrigger className="h-9 w-[140px] text-[13px]">
            <ZoruSelectValue placeholder="Status" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
            <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
            <ZoruSelectItem value="sent">Sent</ZoruSelectItem>
            <ZoruSelectItem value="signed">Signed</ZoruSelectItem>
            <ZoruSelectItem value="expired">Expired</ZoruSelectItem>
            <ZoruSelectItem value="terminated">Terminated</ZoruSelectItem>
          </ZoruSelectContent>
        </ZoruSelect>
        <ZoruSelect value={partyFilter} onValueChange={setPartyFilter}>
          <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
            <ZoruSelectValue placeholder="Party" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All parties</ZoruSelectItem>
            {partyOptions.map((p) => (
              <ZoruSelectItem key={p.id} value={p.id}>
                {p.name}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </ZoruSelect>
        <ZoruSelect
          value={expiryFilter}
          onValueChange={(v) =>
            setExpiryFilter(v as 'all' | '30d' | '60d' | '90d')
          }
        >
          <ZoruSelectTrigger className="h-9 w-[140px] text-[13px]">
            <ZoruSelectValue placeholder="Expiry" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">Any expiry</ZoruSelectItem>
            <ZoruSelectItem value="30d">Expiring 30d</ZoruSelectItem>
            <ZoruSelectItem value="60d">Expiring 60d</ZoruSelectItem>
            <ZoruSelectItem value="90d">Expiring 90d</ZoruSelectItem>
          </ZoruSelectContent>
        </ZoruSelect>
        {hasActiveFilters ? (
          <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear
          </ZoruButton>
        ) : null}
      </div>

      {selected.size > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2 shadow-[var(--zoru-shadow-sm)]">
          <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
            <ListChecks className="h-4 w-4 text-zoru-primary" />
            {selected.size} selected
          </div>
          <div className="flex items-center gap-1">
            <ZoruButton size="sm" variant="outline" onClick={exportCsv}>
              Export CSV
            </ZoruButton>
            <ZoruButton
              size="sm"
              variant="destructive"
              onClick={() => setBulkConfirmOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </ZoruButton>
            <ZoruButton
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </ZoruButton>
          </div>
        </div>
      ) : null}

      <ZoruCard>
        <div className="overflow-x-auto rounded-lg border border-border">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-border hover:bg-transparent">
                <ZoruTableHead className="w-8">
                  <ZoruCheckbox
                    checked={headChecked}
                    onCheckedChange={(c) => toggleAll(Boolean(c))}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Title</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Client</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Value</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Start</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">End</ZoruTableHead>
                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                <ZoruTableHead className="w-[200px] text-right text-muted-foreground">
                  Actions
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading && rows.length === 0 ? (
                [...Array(3)].map((_, i) => (
                  <ZoruTableRow key={i} className="border-border">
                    <ZoruTableCell colSpan={8}>
                      <ZoruSkeleton className="h-8 w-full" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : filtered.length === 0 ? (
                <ZoruTableRow className="border-border">
                  <ZoruTableCell
                    colSpan={8}
                    className="h-24 text-center text-[13px] text-muted-foreground"
                  >
                    {rows.length === 0
                      ? 'No contracts yet — click Add Contract to get started.'
                      : 'No contracts match these filters.'}
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((row) => (
                  <ZoruTableRow key={row._id} className="border-border">
                    <ZoruTableCell>
                      <ZoruCheckbox
                        checked={selected.has(row._id)}
                        onCheckedChange={() => toggleOne(row._id)}
                        aria-label={`Select ${row.title}`}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] font-medium text-foreground">
                      <EntityRowLink
                        href={`/dashboard/crm/contracts/${row._id}`}
                        label={row.title}
                        subtitle={row.clientName || undefined}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {row.clientName || '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {row.value != null
                        ? new Intl.NumberFormat('en-IN', {
                            style: 'currency',
                            currency: row.currency || 'INR',
                          }).format(row.value)
                        : '—'}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {fmtDate(row.startDate)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-foreground">
                      {fmtDate(row.endDate)}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <StatusPill
                        label={row.status || 'draft'}
                        tone={statusToTone(row.status)}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/dashboard/crm/contracts/${row._id}`}>
                          <ZoruButton variant="outline" size="sm">
                            {row.status === 'signed' ? 'View' : 'Sign'}
                          </ZoruButton>
                        </Link>
                        <ZoruButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(row);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </ZoruButton>
                        <ZoruButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(row._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </ZoruButton>
                      </div>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>

      <ZoruAlertDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete {selected.size} contract{selected.size === 1 ? '' : 's'}?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                runBulkDelete();
              }}
            >
              Delete all
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      <ContractFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        isSaving={isSaving}
        action={saveFormAction}
      />

      <ZoruAlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle className="text-foreground">
              Delete contract?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription className="text-muted-foreground">
              This action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete}>Delete</ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </EntityListShell>
  );
}
