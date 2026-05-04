'use client';

/**
 * /dashboard/facebook/leads — Lead Gen submissions (ZoruUI).
 *
 * Two-column layout: forms list on the left, leads table on the right.
 * Per-lead detail in a ZoruSheet, export-CSV in a ZoruDialog. Same data
 * + handlers as the original wabasimplify version.
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { ColumnDef } from '@tanstack/react-table';
import {
  AlertCircle,
  Download,
  FileText,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';

import {
  getLeadGenForms,
  getLeadsForForm,
} from '@/app/actions/facebook.actions';
import type { FacebookLead, FacebookLeadGenForm } from '@/lib/definitions';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCheckbox,
  ZoruDataTable,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSkeleton,
  cn,
  useZoruToast,
} from '@/components/zoruui';

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex items-center justify-between">
        <ZoruSkeleton className="h-9 w-72" />
        <ZoruSkeleton className="h-9 w-32" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <ZoruSkeleton className="h-64" />
        <ZoruSkeleton className="col-span-2 h-64" />
      </div>
    </div>
  );
}

type LeadRow = FacebookLead;

export default function LeadsPage() {
  const { toast } = useZoruToast();
  const [forms, setForms] = useState<FacebookLeadGenForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [isLoadingLeads, startLeadsTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);

  const [activeLead, setActiveLead] = useState<LeadRow | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportIncludeAllForms, setExportIncludeAllForms] = useState(false);

  useEffect(() => {
    setProjectId(localStorage.getItem('activeProjectId'));
  }, []);

  const fetchForms = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const { forms: fetched, error: fetchError } =
        await getLeadGenForms(projectId);
      if (fetchError) {
        setError(fetchError);
      } else if (fetched) {
        setError(null);
        setForms(fetched);
      }
    });
  }, [projectId]);

  const fetchLeads = useCallback(
    (formId: string) => {
      if (!projectId) return;
      setSelectedFormId(formId);
      setLeads([]);
      startLeadsTransition(async () => {
        const { leads: fetched, error: fetchError } = await getLeadsForForm(
          formId,
          projectId,
        );
        if (fetchError) {
          setError(fetchError);
        } else if (fetched) {
          setError(null);
          setLeads(fetched);
        }
      });
    },
    [projectId],
  );

  useEffect(() => {
    fetchForms();
  }, [projectId, fetchForms]);

  const columns = useMemo<ColumnDef<LeadRow>[]>(
    () => [
      {
        accessorKey: 'created_time',
        header: 'Created',
        cell: ({ row }) =>
          row.original.created_time ? (
            <span className="text-[12px] text-zoru-ink-muted">
              {formatDistanceToNow(new Date(row.original.created_time), {
                addSuffix: true,
              })}
            </span>
          ) : (
            <span className="text-[12px] text-zoru-ink-subtle">—</span>
          ),
      },
      {
        id: 'preview',
        header: 'Preview',
        cell: ({ row }) => {
          const fields = row.original.field_data || [];
          const preview = fields
            .slice(0, 2)
            .map(
              (f) =>
                `${f.name}: ${
                  Array.isArray(f.values) ? f.values.join(', ') : String(f.values)
                }`,
            )
            .join(' · ');
          return (
            <span className="line-clamp-1 text-[12px] text-zoru-ink">
              {preview || '—'}
            </span>
          );
        },
      },
      {
        id: 'fields',
        header: 'Fields',
        cell: ({ row }) => (
          <ZoruBadge variant="outline">
            {row.original.field_data?.length ?? 0} fields
          </ZoruBadge>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => setActiveLead(row.original)}
          >
            View
          </ZoruButton>
        ),
      },
    ],
    [],
  );

  const totalLeads = useMemo(
    () => forms.reduce((sum, f) => sum + (f.leads_count || 0), 0),
    [forms],
  );

  const handleExport = useCallback(() => {
    if (!selectedFormId && !exportIncludeAllForms) {
      toast({
        title: 'Select a form first',
        description: 'Pick a form on the left or enable “All forms”.',
        variant: 'destructive',
      });
      return;
    }
    if (leads.length === 0 && !exportIncludeAllForms) {
      toast({
        title: 'No leads to export',
        description: 'The selected form has no leads loaded.',
        variant: 'destructive',
      });
      return;
    }

    const rows = leads;
    if (rows.length === 0) {
      toast({
        title: 'Nothing loaded',
        description:
          'Open a form first — only loaded leads can be exported in this view.',
        variant: 'destructive',
      });
      return;
    }

    const allKeys = new Set<string>();
    rows.forEach((l) =>
      l.field_data?.forEach((f) => f.name && allKeys.add(f.name)),
    );
    const keys = Array.from(allKeys);
    const header = ['id', 'created_time', ...keys].join(',');
    const lines = rows.map((l) => {
      const map: Record<string, string> = {};
      l.field_data?.forEach((f) => {
        map[f.name] = Array.isArray(f.values)
          ? f.values.join('; ')
          : String(f.values);
      });
      return [
        l.id,
        l.created_time ?? '',
        ...keys.map((k) => JSON.stringify(map[k] ?? '')),
      ].join(',');
    });
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${selectedFormId ?? 'export'}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportOpen(false);
    toast({ title: `Exported ${rows.length} leads` });
  }, [leads, selectedFormId, exportIncludeAllForms, toast]);

  if (isLoading && forms.length === 0) return <PageSkeleton />;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Leads</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Lead Gen</ZoruPageEyebrow>
          <ZoruPageTitle>Lead form submissions</ZoruPageTitle>
          <ZoruPageDescription>
            Browse every lead-gen form on your Page and the leads each one has
            collected. Export to CSV for follow-up.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton variant="outline" size="sm" onClick={fetchForms}>
            <RefreshCw /> Refresh
          </ZoruButton>
          <ZoruButton size="sm" onClick={() => setExportOpen(true)}>
            <Download /> Export CSV
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {!projectId ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>No project selected</ZoruAlertTitle>
          <ZoruAlertDescription>
            Select a project from the dashboard to view leads.
          </ZoruAlertDescription>
        </ZoruAlert>
      ) : error ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Error</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {/* ── Forms list ── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-medium text-zoru-ink">
                Forms ({forms.length})
              </h2>
              {totalLeads > 0 ? (
                <span className="text-[11px] text-zoru-ink-muted">
                  {totalLeads.toLocaleString()} leads
                </span>
              ) : null}
            </div>
            {forms.length === 0 ? (
              <ZoruEmptyState
                compact
                icon={<FileText />}
                title="No lead-gen forms"
                description="Connect a Facebook Page that has lead-gen forms to see them here."
              />
            ) : (
              forms.map((form) => {
                const active = selectedFormId === form.id;
                return (
                  <button
                    key={form.id}
                    type="button"
                    onClick={() => fetchLeads(form.id)}
                    className={cn(
                      'flex flex-col gap-2 rounded-[var(--zoru-radius-lg)] border bg-zoru-bg px-4 py-3 text-left transition-colors',
                      active
                        ? 'border-zoru-ink bg-zoru-surface-2'
                        : 'border-zoru-line hover:bg-zoru-surface',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="line-clamp-1 text-[13px] text-zoru-ink">
                        {form.name}
                      </p>
                      <ZoruBadge
                        variant={form.status === 'ACTIVE' ? 'default' : 'outline'}
                      >
                        {form.status}
                      </ZoruBadge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-zoru-ink-muted">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {form.leads_count || 0} leads
                      </span>
                      {form.created_time ? (
                        <span>
                          {formatDistanceToNow(new Date(form.created_time), {
                            addSuffix: true,
                          })}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* ── Leads table ── */}
          <div className="md:col-span-2">
            <ZoruCard className="p-0">
              <ZoruCardHeader>
                <ZoruCardTitle className="text-base">
                  {selectedFormId
                    ? forms.find((f) => f.id === selectedFormId)?.name ??
                      'Leads'
                    : 'Select a form to view leads'}
                </ZoruCardTitle>
              </ZoruCardHeader>
              <ZoruCardContent>
                {!selectedFormId ? (
                  <ZoruEmptyState
                    compact
                    icon={<Search />}
                    title="No form selected"
                    description="Click any form on the left to load its leads."
                  />
                ) : isLoadingLeads ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <ZoruSkeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : leads.length === 0 ? (
                  <ZoruEmptyState
                    compact
                    icon={<FileText />}
                    title="No leads for this form"
                    description="The selected form has not collected any leads yet."
                  />
                ) : (
                  <ZoruDataTable
                    columns={columns}
                    data={leads}
                    showColumnMenu={false}
                  />
                )}
              </ZoruCardContent>
            </ZoruCard>
          </div>
        </div>
      )}

      {/* ── Per-lead detail sheet ── */}
      <ZoruSheet
        open={activeLead !== null}
        onOpenChange={(o) => {
          if (!o) setActiveLead(null);
        }}
      >
        <ZoruSheetContent className="sm:max-w-md flex flex-col gap-5">
          <ZoruSheetHeader>
            <ZoruSheetTitle>Lead details</ZoruSheetTitle>
            <ZoruSheetDescription>
              {activeLead?.created_time
                ? `Submitted ${formatDistanceToNow(
                    new Date(activeLead.created_time),
                    { addSuffix: true },
                  )}`
                : 'Submission'}
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          {activeLead ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2">
                <p className="text-[10.5px] uppercase tracking-wide text-zoru-ink-subtle">
                  Lead ID
                </p>
                <p className="font-mono text-[12px] text-zoru-ink">
                  {activeLead.id}
                </p>
              </div>
              <div className="flex flex-col divide-y divide-zoru-line rounded-[var(--zoru-radius)] border border-zoru-line">
                {(activeLead.field_data || []).map((f, i) => (
                  <div key={i} className="flex flex-col gap-0.5 px-3 py-2">
                    <p className="text-[10.5px] uppercase tracking-wide text-zoru-ink-subtle">
                      {f.name}
                    </p>
                    <p className="text-[13px] text-zoru-ink">
                      {Array.isArray(f.values)
                        ? f.values.join(', ')
                        : String(f.values)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </ZoruSheetContent>
      </ZoruSheet>

      {/* ── Export-CSV dialog ── */}
      <ZoruDialog open={exportOpen} onOpenChange={setExportOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Export leads</ZoruDialogTitle>
            <ZoruDialogDescription>
              {selectedFormId
                ? `Download all loaded leads from “${
                    forms.find((f) => f.id === selectedFormId)?.name ?? 'form'
                  }” as a CSV.`
                : 'Open a form first to export its leads.'}
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <label className="flex items-center gap-2 select-none">
            <ZoruCheckbox
              checked={exportIncludeAllForms}
              onCheckedChange={(c) => setExportIncludeAllForms(Boolean(c))}
            />
            <span className="text-[12.5px] text-zoru-ink">
              Treat all loaded leads as one export
            </span>
          </label>
          <ZoruDialogFooter>
            <ZoruButton variant="outline" onClick={() => setExportOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton onClick={handleExport}>
              <Download className="h-4 w-4" /> Download CSV
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
