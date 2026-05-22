'use client';

import {
  Card,
  Input,
  Label,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
/**
 * <DealListClient> — canonical Deals list view per CRM_REBUILD_PLAN §1D.
 *
 * Ships:
 *   - KPI strip (open count, open value, won/lost this month, win rate, avg cycle)
 *   - View switcher (table | kanban | calendar)
 *   - Filters (pipeline → stage cascade, owner, status, date range, amount range, tags)
 *   - Saved filter presets ("All", "My open", "Closing this week", "At-risk", "Won")
 *   - Density toggle (Comfortable / Compact / Dense)
 *   - Search across title + client name
 *   - Bulk-action bar (archive / delete / export CSV / change-stage / assign-to)
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { CrmFormDrawer, type FormSection } from '@/components/crm/crm-form-drawer';
import { createCrmDeal, updateCrmDeal } from '@/app/actions/crm-deals.actions';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import { DealKanban } from './deal-kanban';
import { DealCalendar } from './deal-calendar';
import { DealBulkBar } from './deal-bulk-bar';
import {
  DealKpiStrip,
  DealListToolbar,
  type Density,
  type PresetKey,
  type ViewMode,
} from './deal-list-toolbar';
import { useDealBulk } from './use-deal-bulk';
import type { DealKpiSummary, DealListRow } from './types';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface DealListClientProps {
  deals: DealListRow[];
  total: number;
  page: number;
  limit: number;
  initialQuery: string;
  kpi: DealKpiSummary;
  stages: string[];
  defaultCurrency: string;
  currentUserId?: string | null;
  error?: string;
}

const DENSITY_KEY = 'crm.deals.density';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function deriveStatus(stage?: string): string {
  if (!stage) return 'open';
  const s = stage.toLowerCase();
  if (s.includes('won') || s === 'won') return 'won';
  if (s.includes('lost') || s === 'lost') return 'lost';
  return 'open';
}

function toCsv(rows: DealListRow[]): string {
  const head = ['title', 'client', 'amount', 'currency', 'stage', 'status', 'probability', 'expectedClose', 'createdAt'];
  const body = rows.map((r) =>
    [
      r.name,
      r.clientLabel ?? '',
      r.amount ?? '',
      r.currency ?? '',
      r.stage ?? '',
      deriveStatus(r.stage),
      r.probability ?? '',
      r.expectedClose ?? '',
      r.createdAt ?? '',
    ]
      .map((cell) => {
        const v = String(cell ?? '');
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      })
      .join(','),
  );
  return [head.join(','), ...body].join('\n');
}

function countWonLost(rows: DealListRow[]): { won: number; lost: number } {
  let won = 0;
  let lost = 0;
  for (const r of rows) {
    const s = deriveStatus(r.stage);
    if (s === 'won') won++;
    else if (s === 'lost') lost++;
  }
  return { won, lost };
}

function fmtMoney(value?: number | null, currency = 'INR'): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function DealListClient({
  deals: serverDeals,
  total,
  page,
  limit,
  initialQuery,
  kpi,
  stages,
  defaultCurrency,
  currentUserId,
  error,
}: DealListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();

  /* View mode + filters */
  const [view, setView] = React.useState<ViewMode>('table');
  const [query, setQuery] = React.useState(initialQuery);
  const [pipelineFilter, setPipelineFilter] = React.useState<string | null>(null);
  const [stageFilter, setStageFilter] = React.useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [tagFilter, setTagFilter] = React.useState<string>('');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [amountMin, setAmountMin] = React.useState('');
  const [amountMax, setAmountMax] = React.useState('');
  const [probMax, setProbMax] = React.useState('');
  const [preset, setPreset] = React.useState<PresetKey>('all');
  const [density, setDensity] = React.useState<Density>('comfortable');

  /* Selection */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const toggleRow = React.useCallback(
    (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );

  /* Confirm dialog state */
  const [deletePending, setDeletePending] = React.useState(false);
  const [archivePending, setArchivePending] = React.useState(false);

  /* Bulky Grid & Form Drawer integrations */
  const bulky = useCrmBulkyState<DealListRow>({
    initialData: serverDeals,
  });

  React.useEffect(() => {
    bulky.setData(serverDeals);
  }, [serverDeals]);

  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isSavingDrawer, setIsSavingDrawer] = React.useState(false);
  const [editingDealId, setEditingDealId] = React.useState<string | null>(null);

  const [formName, setFormName] = React.useState('');
  const [formValue, setFormValue] = React.useState<number>(0);
  const [formStage, setFormStage] = React.useState('');
  const [formPipelineId, setFormPipelineId] = React.useState('');
  const [formOwnerId, setFormOwnerId] = React.useState('');
  const [formAccountId, setFormAccountId] = React.useState('');
  const [formContactId, setFormContactId] = React.useState('');
  const [formCloseDate, setFormCloseDate] = React.useState('');
  const [formProbability, setFormProbability] = React.useState<number>(50);
  const [formPriority, setFormPriority] = React.useState<string>('medium');
  const [formNextStep, setFormNextStep] = React.useState('');
  const [formCampaign, setFormCampaign] = React.useState('');
  const [formLossReason, setFormLossReason] = React.useState('');

  const handleOpenDrawerForNew = () => {
    setEditingDealId(null);
    setFormName('');
    setFormValue(0);
    setFormStage(stages[0] || 'Qualification');
    setFormPipelineId('');
    setFormOwnerId(currentUserId || '');
    setFormAccountId('');
    setFormContactId('');
    setFormCloseDate(new Date(Date.now() + 30 * 86_400_000).toISOString().substring(0, 10));
    setFormProbability(50);
    setFormPriority('medium');
    setFormNextStep('');
    setFormCampaign('');
    setFormLossReason('');
    setIsDrawerOpen(true);
  };

  const handleOpenDrawerForEdit = (deal: DealListRow) => {
    setEditingDealId(deal._id);
    setFormName(deal.name || '');
    setFormValue(deal.amount || 0);
    setFormStage(deal.stage || '');
    setFormPipelineId(deal.pipelineId || '');
    setFormOwnerId(deal.ownerId || '');
    setFormAccountId(deal.accountId || '');
    setFormContactId(deal.contactId || '');
    setFormCloseDate(deal.expectedClose ? new Date(deal.expectedClose).toISOString().substring(0, 10) : '');
    setFormProbability(deal.probability ?? 50);
    setFormPriority(deal.priority || 'medium');
    setFormNextStep(deal.nextStep || '');
    setFormCampaign(deal.campaign || '');
    setFormLossReason(deal.wonLossReason || '');
    setIsDrawerOpen(true);
  };

  const handleSaveDrawer = async () => {
    if (!formName.trim()) {
      toast({ title: 'Validation error', description: 'Deal name is required.', variant: 'destructive' });
      return;
    }

    setIsSavingDrawer(true);
    try {
      if (editingDealId) {
        const res = await updateCrmDeal(editingDealId, {
          name: formName,
          value: formValue,
          stage: formStage,
          pipelineId: formPipelineId || null,
          ownerId: formOwnerId || null,
          accountId: formAccountId || null,
          contactId: formContactId || null,
          expectedClose: formCloseDate || null,
          probability: formProbability,
          priority: formPriority as any,
          nextStep: formNextStep || null,
          campaign: formCampaign || null,
          wonLossReason: formLossReason || null,
        });

        if (res.success) {
          toast({ title: 'Deal updated', description: 'Changes saved successfully.' });
          setIsDrawerOpen(false);
          router.refresh();
        } else {
          toast({ title: 'Error', description: res.error || 'Failed to update deal.', variant: 'destructive' });
        }
      } else {
        const fd = new FormData();
        fd.append('name', formName);
        fd.append('value', String(formValue));
        fd.append('stage', formStage);
        if (formPipelineId) fd.append('pipelineId', formPipelineId);
        if (formOwnerId) fd.append('ownerId', formOwnerId);
        if (formAccountId) fd.append('accountId', formAccountId);
        if (formContactId) fd.append('contactId', formContactId);
        if (formCloseDate) fd.append('closeDate', formCloseDate);
        fd.append('probability', String(formProbability));
        fd.append('priority', formPriority);
        if (formNextStep) fd.append('nextStep', formNextStep);
        if (formCampaign) fd.append('campaign', formCampaign);
        if (formLossReason) fd.append('lossReason', formLossReason);

        const res = await createCrmDeal(null, fd);
        if (res?.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
          toast({ title: 'Deal created', description: 'New deal successfully added.' });
          setIsDrawerOpen(false);
          router.refresh();
        }
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Could not save deal data.', variant: 'destructive' });
    } finally {
      setIsSavingDrawer(false);
    }
  };

  const handleSaveInlineEdit = async (id: string, updatedData: Partial<DealListRow>) => {
    try {
      const res = await updateCrmDeal(id, {
        name: updatedData.name,
        value: updatedData.amount,
        pipelineId: updatedData.pipelineId,
        accountId: updatedData.accountId,
        contactId: updatedData.contactId,
        ownerId: updatedData.ownerId,
        stage: updatedData.stage,
        probability: updatedData.probability,
        expectedClose: updatedData.expectedClose,
      });

      if (res.success) {
        toast({ title: 'Deal updated', description: 'Inline changes saved successfully.' });
        bulky.cancelInlineEdit();
        router.refresh();
      } else {
        toast({ title: 'Update failed', description: res.error || 'Please try again.', variant: 'destructive' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Could not save inline edits.', variant: 'destructive' });
    }
  };

  const columns = React.useMemo<ColumnDef<DealListRow>[]>(() => [
    {
      key: 'name',
      header: 'Title',
      sortable: true,
      render: (row) => (
        <EntityRowLink
          href={`/dashboard/crm/sales-crm/deals/${row._id}`}
          label={row.name || 'Untitled deal'}
          subtitle={row.stage || undefined}
        />
      ),
      editRender: (row, value, onChange) => (
        <Input
          size="sm"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-[12.5px]"
        />
      )
    },
    {
      key: 'clientLabel',
      header: 'Client',
      sortable: true,
      render: (row) => {
        if (row.accountId) {
          return <EntityPickerChip entity="client" id={row.accountId} />;
        } else if (row.contactId) {
          return <EntityPickerChip entity="contact" id={row.contactId} />;
        }
        return <span className="text-zoru-ink-muted">{row.clientLabel ?? '—'}</span>;
      },
      editRender: (row, value, onChange) => {
        return (
          <EntityFormField
            entity="client"
            name="accountId"
            initialId={row.accountId || row.contactId}
            onChange={(next) => onChange(next)}
          />
        );
      }
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (row) => fmtMoney(row.amount, row.currency ?? defaultCurrency),
      editRender: (row, value, onChange) => (
        <Input
          type="number"
          size="sm"
          value={value ?? ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 text-[12.5px]"
        />
      )
    },
    {
      key: 'stage',
      header: 'Stage',
      sortable: true,
      render: (row) => row.stage ? <StatusPill label={row.stage} tone={statusToTone(row.stage)} /> : '—',
      editRender: (row, value, onChange) => (
        <EntityFormField
          entity="stage"
          name="stage"
          initialId={row.stage}
          onChange={(next) => onChange(next)}
        />
      )
    },
    {
      key: 'pipelineId',
      header: 'Pipeline',
      sortable: true,
      render: (row) => row.pipelineId ? <EntityPickerChip entity="pipeline" id={row.pipelineId} /> : '—',
      editRender: (row, value, onChange) => (
        <EntityFormField
          entity="pipeline"
          name="pipelineId"
          initialId={row.pipelineId}
          onChange={(next) => onChange(next)}
        />
      )
    },
    {
      key: 'ownerId',
      header: 'Owner',
      sortable: true,
      render: (row) => row.ownerId ? <EntityPickerChip entity="user" id={row.ownerId} /> : '—',
      editRender: (row, value, onChange) => (
        <EntityFormField
          entity="user"
          name="ownerId"
          initialId={row.ownerId}
          onChange={(next) => onChange(next)}
        />
      )
    },
    {
      key: 'probability',
      header: 'Probability',
      sortable: true,
      render: (row) => typeof row.probability === 'number' ? `${row.probability}%` : '—',
      editRender: (row, value, onChange) => (
        <Input
          type="number"
          size="sm"
          value={value ?? ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 text-[12.5px]"
        />
      )
    },
    {
      key: 'expectedClose',
      header: 'Expected Close',
      sortable: true,
      render: (row) => fmtDate(row.expectedClose),
      editRender: (row, value, onChange) => (
        <Input
          type="date"
          size="sm"
          value={value ? new Date(value).toISOString().substring(0, 10) : ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-[12.5px]"
        />
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px] text-zoru-ink hover:bg-zoru-surface-2"
            onClick={() => handleOpenDrawerForEdit(row)}
          >
            Edit Drawer
          </Button>
          <Link href={`/dashboard/crm/sales-crm/deals/${row._id}`} className="text-[11px] text-primary hover:underline font-medium">
            360° View
          </Link>
        </div>
      )
    }
  ], [defaultCurrency, stages]);

  const formSections: FormSection[] = [
    {
      id: 'profile',
      label: 'Deal Profile',
      render: () => (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Deal Name / Title</Label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Acme Q3 License Agreement" />
          </div>
          <div className="space-y-1.5">
            <Label>Pipeline Stage</Label>
            <EntityFormField
              entity="stage"
              name="stage"
              initialId={formStage}
              onChange={(next) => setFormStage(next)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Pipeline</Label>
            <EntityFormField
              entity="pipeline"
              name="pipelineId"
              initialId={formPipelineId}
              onChange={(next) => setFormPipelineId(next)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Owner / Assignee</Label>
            <EntityFormField
              entity="user"
              name="ownerId"
              initialId={formOwnerId}
              onChange={(next) => setFormOwnerId(next)}
            />
          </div>
        </div>
      )
    },
    {
      id: 'client',
      label: 'Client & Contact',
      render: () => (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Associated Account / Client</Label>
            <EntityFormField
              entity="client"
              name="accountId"
              initialId={formAccountId}
              onChange={(next) => {
                setFormAccountId(next);
                if (next) setFormContactId('');
              }}
            />
          </div>
          <div className="text-center text-xs text-zoru-ink-muted my-2">— OR —</div>
          <div className="space-y-1.5">
            <Label>Associated Contact</Label>
            <EntityFormField
              entity="contact"
              name="contactId"
              initialId={formContactId}
              onChange={(next) => {
                setFormContactId(next);
                if (next) setFormAccountId('');
              }}
            />
          </div>
        </div>
      )
    },
    {
      id: 'forecast',
      label: 'Forecast & Dates',
      render: () => (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Deal Amount ({defaultCurrency})</Label>
            <Input type="number" value={formValue} onChange={(e) => setFormValue(Number(e.target.value))} placeholder="Amount value" />
          </div>
          <div className="space-y-1.5">
            <Label>Win Probability (%)</Label>
            <Input type="number" min={0} max={100} value={formProbability} onChange={(e) => setFormProbability(Number(e.target.value))} placeholder="e.g. 50" />
          </div>
          <div className="space-y-1.5">
            <Label>Expected Close Date</Label>
            <Input type="date" value={formCloseDate} onChange={(e) => setFormCloseDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <select
              className="flex h-9 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 py-1.5 text-[13px] text-zoru-ink shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={formPriority}
              onChange={(e) => setFormPriority(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
      )
    },
    {
      id: 'custom',
      label: 'Custom Fields & Notes',
      render: () => (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Next Steps</Label>
            <Input value={formNextStep} onChange={(e) => setFormNextStep(e.target.value)} placeholder="e.g. Send agreement draft" />
          </div>
          <div className="space-y-1.5">
            <Label>Campaign</Label>
            <Input value={formCampaign} onChange={(e) => setFormCampaign(e.target.value)} placeholder="Marketing campaign source" />
          </div>
          <div className="space-y-1.5">
            <Label>Won/Loss Reason</Label>
            <Input value={formLossReason} onChange={(e) => setFormLossReason(e.target.value)} placeholder="If deal closed, what was the reason?" />
          </div>
        </div>
      )
    }
  ];

  /* Hydrate density from localStorage on mount. */
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DENSITY_KEY);
      if (raw === 'comfortable' || raw === 'compact' || raw === 'dense') {
        setDensity(raw);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleDensityChange = React.useCallback((next: Density) => {
    setDensity(next);
    try {
      window.localStorage.setItem(DENSITY_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  /* Filtered + sorted view */
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = amountMin ? Number(amountMin) : Number.NEGATIVE_INFINITY;
    const max = amountMax ? Number(amountMax) : Number.POSITIVE_INFINITY;
    const probMaxN = probMax ? Number(probMax) : Number.POSITIVE_INFINITY;
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() : null;

    return serverDeals.filter((d) => {
      if (q) {
        const hay = `${d.name ?? ''} ${d.clientLabel ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (pipelineFilter && d.pipelineId !== pipelineFilter) return false;
      if (stageFilter && d.stage !== stageFilter) return false;
      if (ownerFilter && d.ownerId !== ownerFilter) return false;
      if (statusFilter !== 'all' && deriveStatus(d.stage) !== statusFilter) return false;
      const amount = typeof d.amount === 'number' ? d.amount : 0;
      if (amount < min || amount > max) return false;
      if (typeof d.probability === 'number' && d.probability > probMaxN) return false;
      if (from && d.expectedClose) {
        const t = new Date(d.expectedClose).getTime();
        if (!Number.isNaN(t) && t < from) return false;
      }
      if (to && d.expectedClose) {
        const t = new Date(d.expectedClose).getTime();
        if (!Number.isNaN(t) && t > to) return false;
      }
      if (tagFilter && !(d.tags ?? []).some((t) => t.toLowerCase().includes(tagFilter.toLowerCase()))) {
        return false;
      }
      return true;
    });
  }, [
    serverDeals,
    query,
    pipelineFilter,
    stageFilter,
    ownerFilter,
    statusFilter,
    fromDate,
    toDate,
    amountMin,
    amountMax,
    probMax,
    tagFilter,
  ]);

  /* Bulk actions */
  const allSelectedOnPage =
    filtered.length > 0 && filtered.every((d) => selected.has(d._id));
  const toggleAll = React.useCallback(
    () =>
      setSelected((prev) => {
        if (filtered.length === 0) return prev;
        const allSel = filtered.every((d) => prev.has(d._id));
        if (allSel) {
          const next = new Set(prev);
          for (const d of filtered) next.delete(d._id);
          return next;
        }
        const next = new Set(prev);
        for (const d of filtered) next.add(d._id);
        return next;
      }),
    [filtered],
  );

  const exportCsv = React.useCallback(() => {
    const rows = filtered.filter((d) => selected.size === 0 || selected.has(d._id));
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Filter or select rows first.' });
      return;
    }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deals-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${rows.length} deals saved to CSV.` });
  }, [filtered, selected, toast]);

  const clearFilters = React.useCallback(() => {
    setQuery('');
    setPipelineFilter(null);
    setStageFilter(null);
    setOwnerFilter(null);
    setStatusFilter('all');
    setTagFilter('');
    setFromDate('');
    setToDate('');
    setAmountMin('');
    setAmountMax('');
    setProbMax('');
    setPreset('all');
  }, []);

  /* Saved filter presets */
  const applyPreset = React.useCallback(
    (key: PresetKey) => {
      setPreset(key);
      const today = new Date();
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      if (key === 'all') {
        clearFilters();
        return;
      }
      if (key === 'my-open') {
        setStatusFilter('open');
        setOwnerFilter(currentUserId ?? null);
        setFromDate('');
        setToDate('');
        setProbMax('');
        return;
      }
      if (key === 'closing-week') {
        const next7 = new Date(today.getTime() + 7 * 86_400_000);
        setStatusFilter('open');
        setFromDate(fmt(today));
        setToDate(fmt(next7));
        setProbMax('');
        return;
      }
      if (key === 'at-risk') {
        const next14 = new Date(today.getTime() + 14 * 86_400_000);
        setStatusFilter('open');
        setProbMax('30');
        setFromDate('');
        setToDate(fmt(next14));
        return;
      }
      if (key === 'won') {
        setStatusFilter('won');
        setOwnerFilter(null);
        setFromDate('');
        setToDate('');
        setProbMax('');
      }
    },
    [clearFilters, currentUserId],
  );

  /* Bulk action handlers */
  const bulk = useDealBulk({
    selected,
    onCleared: () => setSelected(new Set()),
  });

  const filtersActive =
    Boolean(query) ||
    Boolean(pipelineFilter) ||
    Boolean(stageFilter) ||
    Boolean(ownerFilter) ||
    statusFilter !== 'all' ||
    Boolean(tagFilter) ||
    Boolean(fromDate) ||
    Boolean(toDate) ||
    Boolean(amountMin) ||
    Boolean(amountMax) ||
    Boolean(probMax);

  /* KPI: win rate. */
  const winRate = React.useMemo(() => {
    const { won, lost } = countWonLost(serverDeals);
    const total = won + lost;
    if (total === 0) return null;
    return Math.round((won / total) * 1000) / 10;
  }, [serverDeals]);

  /* ─── Render ─────────────────────────────────────────────────────── */

  return (
    <div className="flex w-full flex-col gap-5">
      {/* KPI strip */}
      <DealKpiStrip
        kpi={kpi}
        defaultCurrency={defaultCurrency}
        winRate={winRate}
        onWinRateClick={() => setStatusFilter('won')}
      />

      {error ? (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-400">
          {error}
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        {/* Toolbar */}
        <DealListToolbar
          query={query}
          onQueryChange={setQuery}
          view={view}
          onViewChange={setView}
          density={density}
          onDensityChange={handleDensityChange}
          preset={preset}
          onPresetChange={applyPreset}
          onExportCsv={exportCsv}
          onNewClick={handleOpenDrawerForNew}
        />

        {/* Filters */}
        <details className="border-b border-zoru-line bg-zoru-surface-2/40" open>
          <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium uppercase tracking-wide text-zoru-ink-muted">
            Filters {filtersActive ? <span className="ml-2 text-zoru-ink">·</span> : null}
            {filtersActive ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  clearFilters();
                }}
                className="ml-1 text-zoru-primary hover:underline"
              >
                clear all
              </button>
            ) : null}
          </summary>
          <div className="grid gap-3 px-3 pb-3 md:grid-cols-3 lg:grid-cols-4">
            <div className="space-y-1">
              <Label>Pipeline</Label>
              <EntityFormField
                entity="pipeline"
                name="_filter_pipeline"
                initialId={pipelineFilter}
                onChange={(next) => {
                  setPipelineFilter(next);
                  setStageFilter(null);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Stage</Label>
              <EntityFormField
                entity="stage"
                name="_filter_stage"
                initialId={stageFilter}
                filter={pipelineFilter ? { pipelineId: pipelineFilter } : undefined}
                onChange={(next) => setStageFilter(next)}
              />
            </div>
            <div className="space-y-1">
              <Label>Owner</Label>
              <EntityFormField
                entity="user"
                name="_filter_owner"
                initialId={ownerFilter}
                onChange={(next) => setOwnerFilter(next)}
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <EnumFilterField
                enumName="dealStatus"
                value={statusFilter}
                onChange={setStatusFilter}
                allLabel="All statuses"
              />
            </div>
            <div className="space-y-1">
              <Label>Expected close — from</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Expected close — to</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Amount min</Label>
              <Input
                type="number"
                value={amountMin}
                onChange={(e) => setAmountMin(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label>Amount max</Label>
              <Input
                type="number"
                value={amountMax}
                onChange={(e) => setAmountMax(e.target.value)}
                placeholder="∞"
              />
            </div>
            <div className="space-y-1">
              <Label>Probability max %</Label>
              <Input
                type="number"
                value={probMax}
                onChange={(e) => setProbMax(e.target.value)}
                placeholder="100"
              />
            </div>
            <div className="space-y-1">
              <Label>Tag</Label>
              <Input
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="any-tag"
              />
            </div>
          </div>
        </details>

        {/* Bulk action bar */}
        <DealBulkBar
          count={selected.size}
          stages={stages}
          onExportCsv={exportCsv}
          onClear={() => setSelected(new Set())}
          onArchive={() => setArchivePending(true)}
          onDelete={() => setDeletePending(true)}
          onChangeStage={bulk.changeStage}
          onAssign={bulk.assign}
        />

        {/* Body */}
        {view === 'kanban' ? (
          <div className="p-3">
            <DealKanban deals={filtered} stages={stages} currency={defaultCurrency} />
          </div>
        ) : view === 'calendar' ? (
          <div className="p-3">
            <DealCalendar deals={filtered} />
          </div>
        ) : (
          <CrmBulkyGrid<DealListRow>
            columns={columns}
            data={filtered}
            selectedIds={selected}
            onSelectOne={toggleRow}
            onSelectAll={(checked) => {
              setSelected((prev) => {
                const next = new Set(prev);
                if (checked) {
                  filtered.forEach((d) => next.add(d._id));
                } else {
                  filtered.forEach((d) => next.delete(d._id));
                }
                return next;
              });
            }}
            density={density}
            inlineEditRowId={bulky.inlineEditRowId}
            editBuffer={bulky.editBuffer}
            onStartInlineEdit={bulky.startInlineEdit}
            onCancelInlineEdit={bulky.cancelInlineEdit}
            onSaveInlineEdit={handleSaveInlineEdit}
            onUpdateEditBuffer={bulky.updateEditBuffer}
            isLoading={bulky.isPending}
          />
        )}

        {view === 'table' ? (
          <div className="border-t border-zoru-line p-3">
            <PaginationBar
              page={page}
              limit={limit}
              total={total}
              hasMore={page * limit < total}
            />
          </div>
        ) : null}
      </Card>

      {/* Bulk-archive confirm */}
      <ConfirmDialog
        open={archivePending}
        onOpenChange={setArchivePending}
        title={`Archive ${selected.size} deal${selected.size === 1 ? '' : 's'}?`}
        description="Archived deals are hidden from default views but can be restored later."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => bulk.archive()}
      />

      {/* Bulk-delete confirm */}
      <ConfirmDialog
        open={deletePending}
        onOpenChange={setDeletePending}
        title={`Delete ${selected.size} deal${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected deals. This action cannot be undone."
        confirmLabel="Delete"
        requireTyped="DELETE"
        onConfirm={async () => bulk.remove()}
      />

      {/* Premium Form Drawer Integration */}
      <CrmFormDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        title={editingDealId ? 'Edit Deal Opportunity' : 'Create New Deal Opportunity'}
        description="Track high-value prospects, forecast wins, and configure statutory profiles."
        sections={formSections}
        onSave={handleSaveDrawer}
        isSaving={isSavingDrawer}
      />

      {bulk.pending ? <span className="sr-only">Working…</span> : null}
    </div>
  );
}
