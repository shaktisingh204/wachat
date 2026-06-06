'use client';

import { Alert, AlertDescription, AlertTitle, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, Skeleton, Table, TBody, Td, Th, THead, Tr, toast } from '@/components/sabcrm/20ui';
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
          toast.error(res.error);
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
      toast.info('No leads to export.');
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
    toast.success(`Exported ${leads.length} lead(s).`);
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Inbox />}
          title="No project selected"
          description="Pick a Facebook page / project to see Lead Gen forms and leads."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">Meta Suite</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Leads</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-[var(--st-text)]">Leads</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            Facebook Lead Gen forms and the leads captured against them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={refreshForms} disabled={loadingForms}>
            <RefreshCw
              className={loadingForms ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'}
            />
            Refresh
          </Button>
          <Button
            onClick={handleExport}
            disabled={!selectedForm || leads.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not load forms</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[320px_1fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Forms</CardTitle>
          </CardHeader>
          <CardBody>
            {loadingForms && forms.length === 0 ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : forms.length === 0 ? (
              <EmptyState
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
                            ? 'border-[var(--st-border-strong)] bg-[var(--st-bg-muted)]'
                            : 'border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]')
                        }
                      >
                        <span className="line-clamp-1 text-sm text-[var(--st-text)]">
                          {f.name}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-[var(--st-text-secondary)]">
                          <Badge variant="secondary">
                            {f.leads_count ?? 0} leads
                          </Badge>
                          <span>{fmtDate(f.created_time)}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedForm ? `Leads · ${selectedForm.name}` : 'Leads'}
            </CardTitle>
          </CardHeader>
          <CardBody>
            {!selectedForm ? (
              <EmptyState
                icon={<Inbox />}
                title="Pick a form"
                description="Select a Lead Gen form on the left to see its leads."
              />
            ) : loadingLeads && leads.length === 0 ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : leads.length === 0 ? (
              <EmptyState
                icon={<Inbox />}
                title="No leads yet"
                description="No submissions captured against this form."
              />
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Phone</Th>
                    <Th className="text-right">Created</Th>
                  </Tr>
                </THead>
                <TBody>
                  {leads.map((l) => {
                    const name = pickField(l, ['full_name', 'name']) ?? '—';
                    const email = pickField(l, ['email']) ?? '—';
                    const phone =
                      pickField(l, ['phone_number', 'phone']) ?? '—';
                    return (
                      <Tr
                        key={l.id}
                        onClick={() => setSelectedLead(l)}
                        className="cursor-pointer"
                      >
                        <Td className="font-medium text-[var(--st-text)]">
                          <span className="inline-flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                            {name}
                          </span>
                        </Td>
                        <Td>
                          <span className="inline-flex items-center gap-2 text-[var(--st-text-secondary)]">
                            <Mail className="h-3.5 w-3.5" />
                            {email}
                          </span>
                        </Td>
                        <Td>
                          <span className="inline-flex items-center gap-2 text-[var(--st-text-secondary)]">
                            <Phone className="h-3.5 w-3.5" />
                            {phone}
                          </span>
                        </Td>
                        <Td className="text-right text-xs text-[var(--st-text-secondary)]">
                          {fmtDate(l.created_time)}
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <Sheet
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
      >
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Lead details</SheetTitle>
            <SheetDescription>
              {selectedLead ? `ID: ${selectedLead.id}` : ''}
            </SheetDescription>
          </SheetHeader>
          {selectedLead ? (
            <div className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col gap-1">
                <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  Submitted
                </p>
                <p className="text-sm text-[var(--st-text)]">
                  {fmtDate(selectedLead.created_time)}
                </p>
              </div>
              <ul className="flex flex-col gap-2">
                {(selectedLead.field_data ?? []).map((f, idx) => (
                  <li
                    key={`${f.name}-${idx}`}
                    className="flex flex-col gap-0.5 rounded-md border border-[var(--st-border)] px-3 py-2"
                  >
                    <span className="text-[11px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                      {f.name}
                    </span>
                    <span className="break-words text-sm text-[var(--st-text)]">
                      {(f.values ?? []).join(', ') || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
