'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
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
  Card,
  Input,
  Label,
  StatCard,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  CalendarClock,
  Download,
  FileSpreadsheet,
  Mail,
  Phone,
  Trash2,
  Users,
  Plus,
  TrendingUp,
  X,
} from 'lucide-react';

import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { SavedViewsBar } from '@/components/crm/SavedViewsBar';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import { deleteLeadAction, saveLeadAction, updateLead, listLeads } from '@/app/actions/crm/leads.actions';
import { useT } from '@/lib/i18n/client';
import type { CrmLeadDoc } from '@/lib/rust-client/crm-leads';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import type { SavedView } from '@/lib/saved-views/types';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { CustomFieldInput, type CustomFieldValue } from '@/components/crm/custom-field-input';

// Phase 1 advanced bulky components
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { CrmFilterPanel } from '@/components/crm/crm-filter-panel';
import { CrmFormDrawer } from '@/components/crm/crm-form-drawer';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';

interface LeadListClientProps {
  leads: CrmLeadDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  error?: string;
  customFields?: WsCustomField[];
}

function fullName(l: CrmLeadDoc, fallback: string): string {
  return [l.firstName, l.lastName].filter(Boolean).join(' ') || l.email || fallback;
}

function fmtMoney(
  value: number | undefined,
  currency: string | undefined,
  locale: string,
): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || 'INR'} ${value}`;
  }
}

interface LeadPageKpis {
  total: number;
  withValue: number;
  totalValue: number;
  addedThisMonth: number;
}

function computeLeadKpis(leads: CrmLeadDoc[]): LeadPageKpis {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  let withValue = 0;
  let totalValue = 0;
  let addedThisMonth = 0;
  for (const l of leads) {
    if (typeof l.estimatedValue === 'number' && l.estimatedValue > 0) {
      withValue++;
      totalValue += l.estimatedValue;
    }
    const created = l.createdAt || l.audit?.createdAt;
    if (created && new Date(created).getTime() >= startOfMonth.getTime()) {
      addedThisMonth++;
    }
  }
  return { total: leads.length, withValue, totalValue, addedThisMonth };
}

const LEAD_STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost'];

export function LeadListClient({
  leads: initialLeads,
  page: initialPage,
  limit: initialLimit,
  hasMore: initialHasMore,
  initialQuery,
  error,
  customFields = [],
}: LeadListClientProps) {
  const { toast } = useZoruToast();
  const { t, locale } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const unnamedLabel = t('crm.leads.list.unnamed', 'Unnamed Lead');

  /* ─── KPI computation from page data ───────────────────────────────────── */
  const kpis = React.useMemo(() => computeLeadKpis(initialLeads), [initialLeads]);

  /* ─── Drawer & Selection States ────────────────────────────────────────── */
  const [isFormDrawerOpen, setIsFormDrawerOpen] = React.useState(false);
  const [formLead, setFormLead] = React.useState<Partial<CrmLeadDoc>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [pendingDeleteLead, setPendingDeleteLead] = React.useState<CrmLeadDoc | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [bulkDeleting, startBulkDelete] = React.useTransition();
  const [bulkConfirmOpen, setBulkConfirmOpen] = React.useState(false);
  const [gridDensity, setGridDensity] = React.useState<'comfortable' | 'compact' | 'dense'>('comfortable');

  const [customFieldValues, setCustomFieldValues] = React.useState<Record<string, CustomFieldValue>>({});

  /* ─── Bulky State Hook ─────────────────────────────────────────────────── */
  const {
    data: leads,
    total,
    page,
    setPage,
    limit,
    filters,
    isPending,
    selected,
    inlineEditRowId,
    editBuffer,
    hasActiveFilters,
    handleSearch,
    updateFilter,
    clearFilters,
    toggleSelectOne,
    toggleSelectAll,
    clearSelection,
    startInlineEdit,
    cancelInlineEdit,
    updateEditBuffer,
    triggerFetch,
    setData,
  } = useCrmBulkyState<CrmLeadDoc>({
    initialData: initialLeads,
    initialPage,
    initialLimit,
    fetchFn: async ({ page, limit, search, filters }) => {
      // Build server request payload
      const response = await listLeads({
        page,
        limit,
        q: search || undefined,
      });

      let items = response.leads;

      // Client-side filtering as BFF only supports q, page, limit
      if (filters.status && filters.status !== 'all') {
        items = items.filter((l) => l.status?.name === filters.status);
      }
      if (filters.source && filters.source !== 'all') {
        items = items.filter(
          (l) =>
            l.attribution?.source === filters.source || l.subSource === filters.source,
        );
      }
      if (filters.ownerId) {
        items = items.filter(
          (l) =>
            (l.ownerId || '').toLowerCase().includes(filters.ownerId.toLowerCase()),
        );
      }

      return {
        items,
        total: response.leads.length, // approximation
        hasMore: response.hasMore,
      };
    },
  });

  // Re-sync hook data when initialLeads prop changes
  React.useEffect(() => {
    setData(initialLeads);
  }, [initialLeads, setData]);

  React.useEffect(() => {
    triggerFetch();
  }, [triggerFetch, page, limit, filters]);

  /* ─── Inline Edit Save ─────────────────────────────────────────────────── */
  const handleSaveInlineEdit = async (id: string, updatedData: Partial<CrmLeadDoc>) => {
    const original = leads.find((l) => l._id.toString() === id);
    if (!original) return;

    try {
      const merged = { ...original, ...updatedData };
      const fd = new FormData();
      fd.set('_id', id);
      fd.set('firstName', merged.firstName);
      fd.set('lastName', merged.lastName);
      if (merged.email) fd.set('email', merged.email);
      if (merged.phone) fd.set('phone', merged.phone);
      if (merged.company) fd.set('company', merged.company);
      if (merged.title) fd.set('title', merged.title);
      if (merged.status?.name) fd.set('status', merged.status.name);
      if (merged.leadScore !== undefined) fd.set('leadScore', String(merged.leadScore));
      if (merged.estimatedValue !== undefined) fd.set('estimatedValue', String(merged.estimatedValue));
      if (merged.currency) fd.set('currency', merged.currency);

      const res = await saveLeadAction(null, fd);
      if (res.error) {
        toast({
          title: 'Inline Edit Failed',
          description: res.error,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Lead saved inline' });
        cancelInlineEdit();
        triggerFetch();
      }
    } catch (err: any) {
      toast({
        title: 'Error saving inline',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  /* ─── Form Drawer Actions ──────────────────────────────────────────────── */
  const handleOpenNewForm = () => {
    setFormLead({
      status: { name: 'new' },
      leadScore: 0,
      currency: 'INR',
    });
    setCustomFieldValues({});
    setIsFormDrawerOpen(true);
  };

  const handleOpenEditForm = (lead: CrmLeadDoc) => {
    setFormLead({ ...lead });
    const bag = (lead.customFields ?? {}) as Record<string, unknown>;
    const seed: Record<string, CustomFieldValue> = {};
    for (const f of customFields) {
      const v = bag[f.name];
      if (v !== undefined) seed[f.name] = v as CustomFieldValue;
    }
    setCustomFieldValues(seed);
    setIsFormDrawerOpen(true);
  };

  const handleUpdateFormField = (field: keyof CrmLeadDoc, value: any) => {
    setFormLead((prev) => ({ ...prev, [field]: value }));
  };

  const handleCustomFieldChange = (name: string, next: CustomFieldValue) => {
    setCustomFieldValues((prev) => ({ ...prev, [name]: next }));
  };

  const onSaveLead = async () => {
    if (!formLead.firstName || !formLead.lastName) {
      toast({
        title: 'Validation Error',
        description: 'First Name and Last Name are required.',
        variant: 'destructive',
      });
      return;
    }
    setIsSaving(true);
    try {
      const fd = new FormData();
      if (formLead._id) fd.set('_id', formLead._id.toString());
      fd.set('firstName', formLead.firstName);
      fd.set('lastName', formLead.lastName);
      if (formLead.email) fd.set('email', formLead.email);
      if (formLead.phone) fd.set('phone', formLead.phone);
      if (formLead.company) fd.set('company', formLead.company);
      if (formLead.title) fd.set('title', formLead.title);
      if (formLead.subSource) fd.set('subSource', formLead.subSource);
      
      const statusName = formLead.status?.name ?? (typeof formLead.status === 'string' ? formLead.status : 'new');
      fd.set('status', statusName);

      if (formLead.leadScore !== undefined) fd.set('leadScore', String(formLead.leadScore));
      if (formLead.estimatedValue !== undefined) fd.set('estimatedValue', String(formLead.estimatedValue));
      if (formLead.currency) fd.set('currency', formLead.currency);
      if (formLead.probabilityPct !== undefined) fd.set('probabilityPct', String(formLead.probabilityPct));
      if (formLead.expectedClose) fd.set('expectedClose', formLead.expectedClose);
      if (formLead.industry) fd.set('industry', formLead.industry);

      // Attribution nested values
      const sourceVal = formLead.attribution?.source ?? (formLead as any).source;
      if (sourceVal) fd.set('source', sourceVal);

      const ownerVal = formLead.ownerId;
      if (ownerVal) fd.set('ownerId', ownerVal);

      const assigneeVal = formLead.assignment?.assignedTo ?? (formLead as any).assignedTo;
      if (assigneeVal) fd.set('assignedTo', assigneeVal);

      // Custom fields payload
      fd.set('customFields', JSON.stringify(customFieldValues));

      const res = await saveLeadAction(null, fd);
      if (res.error) {
        toast({ title: 'Save Failed', description: res.error, variant: 'destructive' });
      } else {
        toast({ title: formLead._id ? 'Lead updated' : 'Lead created' });
        setIsFormDrawerOpen(false);
        triggerFetch();
        router.refresh();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  /* ─── Single & Bulk Delete Actions ──────────────────────────────────────── */
  const runSingleDelete = async () => {
    if (!pendingDeleteLead?._id) return;
    setIsDeleting(true);
    const id = String(pendingDeleteLead._id);
    const name = fullName(pendingDeleteLead, unnamedLabel);
    const res = await deleteLeadAction(id);
    setIsDeleting(false);
    if (res.success) {
      toast({
        title: t('crm.leads.list.toast.deleted', 'Lead Deleted'),
        description: t('crm.leads.list.toast.deletedDescription', { name }),
      });
      setPendingDeleteLead(null);
      triggerFetch();
      router.refresh();
    } else {
      toast({
        title: 'Delete Failed',
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  const runBulkDelete = () => {
    if (selected.size === 0) return;
    setBulkConfirmOpen(false);
    const ids = Array.from(selected);
    startBulkDelete(async () => {
      let ok = 0;
      let failed = 0;
      for (const id of ids) {
        const res = await deleteLeadAction(id);
        if (res.success) ok++;
        else failed++;
      }
      toast({
        title: failed === 0
          ? `${ok} lead${ok === 1 ? '' : 's'} deleted successfully`
          : `${ok} deleted · ${failed} failed`,
        variant: failed > 0 ? 'destructive' : undefined,
      });
      clearSelection();
      triggerFetch();
      router.refresh();
    });
  };

  /* ─── Export ───────────────────────────────────────────────────────────── */
  const exportRows = React.useMemo(() => {
    const subset = selected.size > 0 ? leads.filter((l) => selected.has(String(l._id))) : leads;
    return subset.map((l) => ({
      Name: fullName(l, ''),
      Email: l.email || '',
      Phone: l.phone || '',
      Company: l.company || '',
      Title: l.title || '',
      Status: l.status?.name || '',
      Source: l.attribution?.source || l.subSource || '',
      'Estimated Value': l.estimatedValue ?? '',
      Currency: l.currency || 'INR',
      'Created At': l.createdAt || l.audit?.createdAt || '',
    }));
  }, [leads, selected]);

  const exportHeaders = ['Name', 'Email', 'Phone', 'Company', 'Title', 'Status', 'Source', 'Estimated Value', 'Currency', 'Created At'];

  const exportCsv = React.useCallback(() => {
    downloadCsv(`leads-${dateStamp()}.csv`, exportHeaders, exportRows);
  }, [exportRows]);

  const exportXlsx = React.useCallback(() => {
    void downloadXlsx(`leads-${dateStamp()}.xlsx`, exportHeaders, exportRows, 'Leads');
  }, [exportRows]);

  /* ─── Columns Definition ───────────────────────────────────────────────── */
  const columns = React.useMemo<ColumnDef<CrmLeadDoc>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <EntityRowLink
          href={`/dashboard/crm/leads/${row._id}`}
          label={fullName(row, unnamedLabel)}
          subtitle={row.company || undefined}
        />
      ),
    },
    {
      key: 'firstName',
      header: 'First Name',
      sortable: true,
      render: (row) => <span className="text-[13px] text-[var(--st-text)]">{row.firstName}</span>,
      editRender: (row, value, onChange) => (
        <Input
          size="sm"
          className="h-8 w-32 text-[12.5px]"
          value={value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    },
    {
      key: 'lastName',
      header: 'Last Name',
      sortable: true,
      render: (row) => <span className="text-[13px] text-[var(--st-text)]">{row.lastName}</span>,
      editRender: (row, value, onChange) => (
        <Input
          size="sm"
          className="h-8 w-32 text-[12.5px]"
          value={value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (row) =>
        row.email ? (
          <span className="text-[12.5px] text-[var(--st-text)]">{row.email}</span>
        ) : (
          <span className="text-[var(--st-text-secondary)]">—</span>
        ),
      editRender: (row, value, onChange) => (
        <Input
          type="email"
          size="sm"
          className="h-8 w-44 text-[12.5px]"
          value={value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) =>
        row.phone ? (
          <span className="text-[12.5px] text-[var(--st-text)]">{row.phone}</span>
        ) : (
          <span className="text-[var(--st-text-secondary)]">—</span>
        ),
      editRender: (row, value, onChange) => (
        <Input
          size="sm"
          className="h-8 w-36 text-[12.5px]"
          value={value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    },
    {
      key: 'company',
      header: 'Company',
      sortable: true,
      render: (row) => <span className="text-[13px] text-[var(--st-text)]">{row.company || '—'}</span>,
      editRender: (row, value, onChange) => (
        <Input
          size="sm"
          className="h-8 w-40 text-[12.5px]"
          value={value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <Badge
          variant={
            row.status?.name === 'converted' || row.status?.name === 'Won'
              ? 'success'
              : row.status?.name === 'contacted'
              ? 'warning'
              : row.status?.name === 'lost'
              ? 'danger'
              : 'info'
          }
        >
          {(row.status?.name || 'new').toUpperCase()}
        </Badge>
      ),
      editRender: (row, value, onChange) => (
        <select
          value={value?.name || value || 'new'}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-8 rounded border border-[var(--st-border)] bg-[var(--st-bg)] px-2 py-0.5 text-[12.5px] text-[var(--st-text)] outline-none"
        >
          {LEAD_STATUS_OPTIONS.map((st) => (
            <option key={st} value={st}>
              {st.toUpperCase()}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'estimatedValue',
      header: 'Est. Value',
      sortable: true,
      render: (row) => (
        <span className="text-[12.5px] tabular-nums font-medium text-[var(--st-text)]">
          {fmtMoney(row.estimatedValue, row.currency, locale)}
        </span>
      ),
      editRender: (row, value, onChange) => (
        <Input
          type="number"
          size="sm"
          className="h-8 w-28 text-[12.5px]"
          value={value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : 0)}
        />
      ),
    },
    {
      key: 'leadScore',
      header: 'Lead Score',
      sortable: true,
      render: (row) => (
        <Badge
          variant={
            (row.leadScore ?? 0) > 75
              ? 'success'
              : (row.leadScore ?? 0) > 50
              ? 'warning'
              : 'danger'
          }
        >
          {row.leadScore ?? 0}
        </Badge>
      ),
      editRender: (row, value, onChange) => (
        <Input
          type="number"
          size="sm"
          className="h-8 w-20 text-[12.5px]"
          value={value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : 0)}
        />
      ),
    },
  ], [locale, unnamedLabel]);

  /* ─── Dynamic Segment and Presets Options ──────────────────────────────── */
  const filterFields = React.useMemo(() => [
    {
      key: 'status',
      label: 'Status',
      type: 'select' as const,
      options: LEAD_STATUS_OPTIONS.map((o) => ({ label: o.toUpperCase(), value: o })),
    },
    {
      key: 'source',
      label: 'Attribution Source',
      type: 'select' as const,
      options: [
        { label: 'Website', value: 'website' },
        { label: 'Referral', value: 'referral' },
        { label: 'Social Media', value: 'social' },
        { label: 'Event', value: 'event' },
        { label: 'Cold Outbound', value: 'cold-outbound' },
        { label: 'Advertising', value: 'ad' },
      ],
    },
    { key: 'ownerId', label: 'Owner (SDR)', type: 'text' as const },
  ], []);

  /* ─── Multi-Tab Adaptive Form Sidebar Compiler ─────────────────────────── */
  const formSections = React.useMemo(() => [
    {
      id: 'identity',
      label: 'Identity & Bio',
      render: () => (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">First name *</Label>
            <Input
              value={formLead.firstName || ''}
              onChange={(e) => handleUpdateFormField('firstName', e.target.value)}
              placeholder="Shakti"
              className="h-10 text-[13px]"
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">Last name *</Label>
            <Input
              value={formLead.lastName || ''}
              onChange={(e) => handleUpdateFormField('lastName', e.target.value)}
              placeholder="Singh"
              className="h-10 text-[13px]"
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">Company</Label>
            <Input
              value={formLead.company || ''}
              onChange={(e) => handleUpdateFormField('company', e.target.value)}
              placeholder="Wachats Ltd"
              className="h-10 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">Job title</Label>
            <div className="mt-1">
              <EntityFormField
                entity="jobTitle"
                name="title"
                initialId={formLead.title ?? null}
                onSelect={(val) => handleUpdateFormField('title', val)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">Industry</Label>
            <div className="mt-1">
              <EntityFormField
                entity="industry"
                name="industry"
                initialId={formLead.industry ?? null}
                onSelect={(val) => handleUpdateFormField('industry', val)}
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'contact',
      label: 'Contact & Network',
      render: () => (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">Email address</Label>
            <Input
              type="email"
              value={formLead.email || ''}
              onChange={(e) => handleUpdateFormField('email', e.target.value)}
              placeholder="shakti@wachat.io"
              className="h-10 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">Phone number</Label>
            <Input
              type="tel"
              value={formLead.phone || ''}
              onChange={(e) => handleUpdateFormField('phone', e.target.value)}
              placeholder="+91 99999 99999"
              className="h-10 text-[13px]"
            />
          </div>
        </div>
      ),
    },
    {
      id: 'financials',
      label: 'Financials & Forecast',
      render: () => (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">Estimated value</Label>
            <Input
              type="number"
              value={formLead.estimatedValue !== undefined ? String(formLead.estimatedValue) : ''}
              onChange={(e) =>
                handleUpdateFormField(
                  'estimatedValue',
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              placeholder="150000"
              className="h-10 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">Currency</Label>
            <div className="mt-1">
              <EntityFormField
                entity="currency"
                name="currency"
                initialId={formLead.currency ?? 'INR'}
                onSelect={(val) => handleUpdateFormField('currency', val)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">Probability %</Label>
            <Input
              type="number"
              value={formLead.probabilityPct !== undefined ? String(formLead.probabilityPct) : ''}
              onChange={(e) =>
                handleUpdateFormField(
                  'probabilityPct',
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              min={0}
              max={100}
              placeholder="75"
              className="h-10 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">Expected close date</Label>
            <input
              type="date"
              value={
                formLead.expectedClose
                  ? new Date(formLead.expectedClose).toISOString().split('T')[0]
                  : ''
              }
              onChange={(e) => handleUpdateFormField('expectedClose', e.target.value)}
              className="flex h-10 w-full rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-1.5 text-[13px] text-[var(--st-text)] shadow-sm"
            />
          </div>
        </div>
      ),
    },
    {
      id: 'marketing',
      label: 'Marketing & Attribution',
      render: () => (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">Status</Label>
            <div className="mt-1">
              <EnumFormField
                enumName="leadStatus"
                name="status"
                initialId={
                  formLead.status?.name ??
                  (typeof formLead.status === 'string' ? formLead.status : 'new')
                }
                placeholder="new"
                onSelect={(val) => handleUpdateFormField('status', { name: val })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">Lead score (0–100)</Label>
            <Input
              type="number"
              value={formLead.leadScore !== undefined ? String(formLead.leadScore) : ''}
              onChange={(e) =>
                handleUpdateFormField(
                  'leadScore',
                  e.target.value ? Number(e.target.value) : 0,
                )
              }
              min={0}
              max={100}
              className="h-10 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">Source</Label>
            <div className="mt-1">
              <EntityFormField
                entity="leadSource"
                name="source"
                initialId={formLead.attribution?.source ?? (formLead as any).source ?? null}
                onSelect={(val) => handleUpdateFormField('source', val)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">Sub-source</Label>
            <Input
              value={formLead.subSource || ''}
              onChange={(e) => handleUpdateFormField('subSource', e.target.value)}
              placeholder="Reference website / flyer"
              className="h-10 text-[13px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">Owner (SDR)</Label>
            <div className="mt-1">
              <EntityFormField
                entity="user"
                name="ownerId"
                initialId={formLead.ownerId ?? null}
                onSelect={(val) => handleUpdateFormField('ownerId', val)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] font-medium text-[var(--st-text-secondary)]">Assigned to (AE)</Label>
            <div className="mt-1">
              <EntityFormField
                entity="user"
                name="assignedTo"
                initialId={formLead.assignment?.assignedTo ?? (formLead as any).assignedTo ?? null}
                onSelect={(val) => handleUpdateFormField('assignedTo', val)}
              />
            </div>
          </div>
        </div>
      ),
    },
    ...(customFields.length > 0
      ? [
          {
            id: 'custom_fields',
            label: 'Custom Fields',
            render: () => (
              <div className="space-y-4">
                {customFields.map((f) => (
                  <div key={String(f._id ?? f.name)} className="space-y-1">
                    <CustomFieldInput
                      field={f}
                      value={customFieldValues[f.name]}
                      onChange={(v) => handleCustomFieldChange(f.name, v)}
                    />
                  </div>
                ))}
              </div>
            ),
          },
        ]
      : []),
  ], [formLead, customFields, customFieldValues]);

  const savedViewFilters = React.useMemo(() => ({ query: initialQuery }), [initialQuery]);
  const handleApplyView = React.useCallback((view: SavedView) => {
    const f = (view.filters ?? {}) as Record<string, unknown>;
    if (typeof f.query === 'string') handleSearch(f.query);
  }, [handleSearch]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Saved Views Control Panel */}
      <SavedViewsBar
        entityKind="lead"
        currentFilters={savedViewFilters}
        currentColumns={[]}
        onApplyView={handleApplyView}
      />

      {/* KPI Metric Blocks */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Total leads"
          value={kpis.total.toLocaleString()}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="With forecast value"
          value={kpis.withValue.toLocaleString()}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Estimated pipeline"
          value={fmtMoney(kpis.totalValue, undefined, locale)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Added (this month)"
          value={kpis.addedThisMonth.toLocaleString()}
          icon={<CalendarClock className="h-4 w-4" />}
        />
      </div>

      {/* Control Surface Filtering Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 w-full bg-[var(--st-bg-muted)]/15 border border-[var(--st-border)]/50 p-2.5 rounded-lg">
        <div className="flex flex-wrap items-center gap-2">
          {/* Omni Search */}
          <div className="relative max-w-xs">
            <Input
              defaultValue={initialQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={t('crm.leads.list.search.placeholder', 'Search leads...')}
              className="h-9 w-60 text-[13px]"
            />
          </div>

          <CrmFilterPanel
            fields={filterFields}
            filters={filters}
            onUpdateFilter={updateFilter}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)] gap-1"
            >
              Reset filters
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-[var(--st-text-secondary)] font-medium">Grid Density:</span>
            <div className="flex items-center rounded-md border border-[var(--st-border)] p-0.5 bg-[var(--st-bg-secondary)]">
              {(['comfortable', 'compact', 'dense'] as const).map((den) => (
                <Button
                  key={den}
                  variant={gridDensity === den ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 text-[10.5px] capitalize px-2 font-semibold"
                  onClick={() => setGridDensity(den)}
                >
                  {den}
                </Button>
              ))}
            </div>
          </div>

          <Button onClick={handleOpenNewForm} className="gap-1.5 h-9 text-[12.5px]">
            <Plus className="h-4 w-4" />
            Add New Lead
          </Button>
        </div>
      </div>

      {/* Sticky Mass Operations Bar */}
      {selected.size > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 shadow-[var(--zoru-shadow-sm)]">
          <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text)]">
            <Badge variant="info">{selected.size} selected</Badge>
            <button
              type="button"
              onClick={clearSelection}
              className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
            >
              Clear
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={exportCsv} className="h-8 text-[12px]">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={exportXlsx} className="h-8 text-[12px]">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Export XLSX
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-[12px] bg-[var(--st-danger)] text-white hover:bg-[var(--st-danger)]/90"
              onClick={() => setBulkConfirmOpen(true)}
              disabled={bulkDeleting}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Selected
            </Button>
          </div>
        </div>
      ) : null}

      {/* Premium High-Density Spreadsheet Power-Grid */}
      <div className="group relative">
        <CrmBulkyGrid
          columns={columns}
          data={leads}
          selectedIds={selected}
          onSelectOne={toggleSelectOne}
          onSelectAll={(checked) =>
            toggleSelectAll(
              leads.map((l) => l._id.toString()),
              checked,
            )
          }
          isLoading={isPending}
          density={gridDensity}
          inlineEditRowId={inlineEditRowId}
          editBuffer={editBuffer}
          onStartInlineEdit={startInlineEdit}
          onCancelInlineEdit={cancelInlineEdit}
          onUpdateEditBuffer={updateEditBuffer}
          onSaveInlineEdit={handleSaveInlineEdit}
        />

        {leads.length > 0 && (
          <div className="absolute right-3 top-14 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] px-2 py-1 rounded-md shadow-sm pointer-events-auto">
            <span className="text-[10px] font-semibold text-[var(--st-text-secondary)] uppercase">
              Power-Grid Enabled
            </span>
          </div>
        )}
      </div>

      {/* Custom Styled Pagination & Actions Footer */}
      {leads.length > 0 ? (
        <PaginationBar
          page={page}
          limit={limit}
          hasMore={page < totalPages}
          total={total}
          controlled={{
            onChange: (next) => setPage(next.page),
          }}
        />
      ) : null}

      {/* Adaptive Tabbed Form Drawer */}
      <CrmFormDrawer
        open={isFormDrawerOpen}
        onOpenChange={setIsFormDrawerOpen}
        title={formLead._id ? 'Edit Lead Profile' : 'Create New Lead'}
        description="Fill out the multi-dimensional layout panels to build the comprehensive lead directory profile."
        sections={formSections}
        onSave={onSaveLead}
        isSaving={isSaving}
      />

      {/* Single lead deletion alert */}
      <ZoruAlertDialog
        open={pendingDeleteLead !== null}
        onOpenChange={(o) => !o && setPendingDeleteLead(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              {t('crm.leads.list.delete.title', 'Confirm Deletion')}
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {t(
                'crm.leads.list.delete.description',
                'This will permanently delete this lead and remove all associated history. This operation is irreversible.',
              )}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={isDeleting}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void runSingleDelete();
              }}
              disabled={isDeleting}
              className="bg-[var(--st-danger)] text-white hover:bg-[var(--st-danger)]/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Bulk Delete Confirm Alert */}
      <ZoruAlertDialog
        open={bulkConfirmOpen}
        onOpenChange={(o) => !o && setBulkConfirmOpen(false)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete {selected.size} Lead{selected.size === 1 ? '' : 's'}?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Are you sure you want to permanently delete the selected leads? This operation is
              irreversible and will remove these records from all tenant accounts.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={bulkDeleting}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                runBulkDelete();
              }}
              disabled={bulkDeleting}
              className="bg-[var(--st-danger)] text-white hover:bg-[var(--st-danger)]/90"
            >
              {bulkDeleting ? 'Deleting Selected...' : 'Delete Selected'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
