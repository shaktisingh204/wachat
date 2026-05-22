'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  EmptyState,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  zoruSonnerToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import {
  AlertCircle,
  Download,
  Inbox,
  Mail,
  Phone,
  RefreshCw,
  User,
  } from 'lucide-react';
import { format } from 'date-fns';

import { useProject } from '@/context/project-context';
import {
  getLeadGenForms,
  getLeadsForForm,
  } from '@/app/actions/facebook.actions';
import type { FacebookLead,
  FacebookLeadGenForm } from '@/lib/definitions';

/**
 * /dashboard/facebook/leads — Lead Gen forms and captured leads.
 *
 * Master/detail layout: left column lists Lead Gen forms (name, leads
 * count, created), right column lists leads for the selected form in a
 * table. Clicking a row opens a Sheet with all field_data. CSV export
 * dumps every lead in the selected form.
 */

import * as React from 'react';

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'MMM d, yyyy HH:mm');
}

function pickField(lead: FacebookLead, names: string[]): string | undefined {
  if (!lead.field_data) return undefined;
  for (const want of names) {
    const wantLc = want.toLowerCase();
    for (const f of lead.field_data) {
      if (f?.name && f.name.toLowerCase().includes(wantLc)) {
        return f.values?.[0];
      }
    }
  }
  return undefined;
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function FacebookLeadsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [forms, setForms] = useState<FacebookLeadGenForm[]>([]);
  const [leads, setLeads] = useState<FacebookLead[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<FacebookLead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingForms, startFormsLoading] = useTransition();
  const [loadingLeads, startLeadsLoading] = useTransition();

  const refreshForms = useCallback(() => {
    if (!projectId) return;
    startFormsLoading(async () => {
      const res = await getLeadGenForms(projectId);
      if (res.error) {
        setError(res.error);
        setForms([]);
        return;
      }
      setError(null);
      setForms(res.forms ?? []);
    });
  }, [projectId]);

  const loadLeads = useCallback(
    (formId: string) => {
      if (!projectId || !formId) return;
      startLeadsLoading(async () => {
        const res = await getLeadsForForm(formId, projectId);
        if (res.error) {
          zoruSonnerToast.error(res.error);
          setLeads([]);
          return;
        }
        setLeads(res.leads ?? []);
      });
    },
    [projectId],
  );

  useEffect(() => {
    refreshForms();
  }, [refreshForms]);

  useEffect(() => {
    if (selectedFormId) loadLeads(selectedFormId);
    else setLeads([]);
  }, [selectedFormId, loadLeads]);

  const selectedForm = useMemo(
    () => forms.find((f) => f.id === selectedFormId) ?? null,
    [forms, selectedFormId],
  );

  const handleExport = () => {
    if (!selectedForm || leads.length === 0) {
      zoruSonnerToast.info('No leads to export.');
      return;
    }
    // Collect all field names across all leads.
    const fieldNames = new Set<string>();
    for (const l of leads) {
      for (const f of l.field_data ?? []) {
        if (f.name) fieldNames.add(f.name);
      }
    }
    const headers = ['id', 'created_time', ...Array.from(fieldNames)];
    const rows: string[][] = [headers];
    for (const l of leads) {
      const row: string[] = [l.id, l.created_time];
      for (const name of fieldNames) {
        const f = l.field_data?.find((x) => x.name === name);
        row.push(f?.values?.join('; ') ?? '');
      }
      rows.push(row);
    }
    const safeName = selectedForm.name.replace(/[^\w-]+/g, '_').slice(0, 64);
    downloadCsv(`leads_${safeName}_${selectedForm.id}.csv`, rows);
    zoruSonnerToast.success(`Exported ${leads.length} lead(s).`);
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState
          icon={<Inbox />}
          title="No project selected"
          description="Pick a Facebook page / project to see Lead Gen forms and leads."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">Meta Suite</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Leads</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-zoru-ink">Leads</h1>
          <p className="mt-1 text-sm text-zoru-ink-muted">
            Facebook Lead Gen forms and the leads captured against them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ZoruButton variant="ghost" onClick={refreshForms} disabled={loadingForms}>
            <RefreshCw
              className={loadingForms ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'}
            />
            Refresh
          </ZoruButton>
          <ZoruButton
            onClick={handleExport}
            disabled={!selectedForm || leads.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </ZoruButton>
        </div>
      </header>

      {error && (
        <ZoruAlert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load forms</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[320px_1fr]">
        <ZoruCard className="self-start">
          <ZoruCardHeader>
            <ZoruCardTitle>Forms</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            {loadingForms && forms.length === 0 ? (
              <div className="flex flex-col gap-2">
                <ZoruSkeleton className="h-12 w-full" />
                <ZoruSkeleton className="h-12 w-full" />
                <ZoruSkeleton className="h-12 w-full" />
              </div>
            ) : forms.length === 0 ? (
              <ZoruEmptyState
                icon={<Inbox />}
                title="No forms"
                description="No Lead Gen forms found for this Page."
              />
            ) : (
              <ul className="flex flex-col gap-1.5">
                {forms.map((f) => {
                  const isActive = f.id === selectedFormId;
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedFormId(f.id)}
                        className={
                          'flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left transition ' +
                          (isActive
                            ? 'border-zoru-line-strong bg-zoru-surface-2'
                            : 'border-zoru-line hover:bg-zoru-surface-2')
                        }
                      >
                        <span className="line-clamp-1 text-sm text-zoru-ink">
                          {f.name}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-zoru-ink-muted">
                          <ZoruBadge variant="secondary">
                            {f.leads_count ?? 0} leads
                          </ZoruBadge>
                          <span>{fmtDate(f.created_time)}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ZoruCardContent>
        </ZoruCard>

        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>
              {selectedForm ? `Leads · ${selectedForm.name}` : 'Leads'}
            </ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            {!selectedForm ? (
              <ZoruEmptyState
                icon={<Inbox />}
                title="Pick a form"
                description="Select a Lead Gen form on the left to see its leads."
              />
            ) : loadingLeads && leads.length === 0 ? (
              <div className="flex flex-col gap-2">
                <ZoruSkeleton className="h-10 w-full" />
                <ZoruSkeleton className="h-10 w-full" />
                <ZoruSkeleton className="h-10 w-full" />
              </div>
            ) : leads.length === 0 ? (
              <ZoruEmptyState
                icon={<Inbox />}
                title="No leads yet"
                description="No submissions captured against this form."
              />
            ) : (
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow>
                    <ZoruTableHead>Name</ZoruTableHead>
                    <ZoruTableHead>Email</ZoruTableHead>
                    <ZoruTableHead>Phone</ZoruTableHead>
                    <ZoruTableHead className="text-right">Created</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {leads.map((l) => {
                    const name = pickField(l, ['full_name', 'name']) ?? '—';
                    const email = pickField(l, ['email']) ?? '—';
                    const phone =
                      pickField(l, ['phone_number', 'phone']) ?? '—';
                    return (
                      <ZoruTableRow
                        key={l.id}
                        onClick={() => setSelectedLead(l)}
                        className="cursor-pointer"
                      >
                        <ZoruTableCell className="font-medium text-zoru-ink">
                          <span className="inline-flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-zoru-ink-muted" />
                            {name}
                          </span>
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <span className="inline-flex items-center gap-2 text-zoru-ink-muted">
                            <Mail className="h-3.5 w-3.5" />
                            {email}
                          </span>
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <span className="inline-flex items-center gap-2 text-zoru-ink-muted">
                            <Phone className="h-3.5 w-3.5" />
                            {phone}
                          </span>
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right text-xs text-zoru-ink-muted">
                          {fmtDate(l.created_time)}
                        </ZoruTableCell>
                      </ZoruTableRow>
                    );
                  })}
                </ZoruTableBody>
              </ZoruTable>
            )}
          </ZoruCardContent>
        </ZoruCard>
      </div>

      <ZoruSheet
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
      >
        <ZoruSheetContent className="w-full sm:max-w-md">
          <ZoruSheetHeader>
            <ZoruSheetTitle>Lead details</ZoruSheetTitle>
            <ZoruSheetDescription>
              {selectedLead ? `ID: ${selectedLead.id}` : ''}
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          {selectedLead ? (
            <div className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-1">
                <p className="text-[11px] uppercase tracking-wide text-zoru-ink-subtle">
                  Submitted
                </p>
                <p className="text-sm text-zoru-ink">
                  {fmtDate(selectedLead.created_time)}
                </p>
              </div>
              <ul className="flex flex-col gap-2">
                {(selectedLead.field_data ?? []).map((f, idx) => (
                  <li
                    key={`${f.name}-${idx}`}
                    className="flex flex-col gap-0.5 rounded-md border border-zoru-line px-3 py-2"
                  >
                    <span className="text-[11px] uppercase tracking-wide text-zoru-ink-subtle">
                      {f.name}
                    </span>
                    <span className="break-words text-sm text-zoru-ink">
                      {(f.values ?? []).join(', ') || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </ZoruSheetContent>
      </ZoruSheet>
    </div>
  );
}
