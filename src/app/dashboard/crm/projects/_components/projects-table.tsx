'use client';

import {
  ZoruButton,
  ZoruCheckbox,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruProgress,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
} from '@/components/zoruui';
import {
  Archive,
  Download,
  Edit,
  Eye,
  MoreHorizontal,
  Trash2,
  } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import type { WsProject } from '@/lib/worksuite/project-types';

export type ProjectRow = WsProject & { _id: string };

const PRIORITY_TONE: Record<string, 'neutral' | 'blue' | 'amber' | 'red'> = {
  low: 'neutral',
  medium: 'blue',
  high: 'amber',
  urgent: 'red',
};

export function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | Date);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function fmtMoney(amt?: number | null, currency = 'INR'): string {
  if (typeof amt !== 'number' || Number.isNaN(amt)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amt);
  } catch {
    return `${currency} ${amt}`;
  }
}

export function isOverdue(p: ProjectRow): boolean {
  const status = (p.status || '').toLowerCase();
  if (['finished', 'completed', 'canceled', 'cancelled'].includes(status)) return false;
  const end = p.deadline ?? p.endDate;
  if (!end) return false;
  const d = new Date(end as string | Date);
  return d.getTime() < Date.now();
}

interface ProjectsTableProps {
  rows: ProjectRow[];
  loading: boolean;
  onDelete: (id: string) => void;
  onBulkArchive: (ids: string[]) => void;
  onBulkDelete: (ids: string[]) => void;
}

export function ProjectsTable({
  rows,
  loading,
  onDelete,
  onBulkArchive,
  onBulkDelete,
}: ProjectsTableProps) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  // Reset selection when the row set changes (e.g. after filter changes).
  React.useEffect(() => {
    setSelected(new Set());
  }, [rows]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r._id));
  const someSelected = selected.size > 0;

  const toggleAll = React.useCallback(
    (checked: boolean) => {
      setSelected(checked ? new Set(rows.map((r) => r._id)) : new Set());
    },
    [rows],
  );

  const toggleOne = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkArchive = React.useCallback(() => {
    onBulkArchive(Array.from(selected));
    setSelected(new Set());
  }, [selected, onBulkArchive]);

  const handleBulkDelete = React.useCallback(() => {
    onBulkDelete(Array.from(selected));
    setSelected(new Set());
  }, [selected, onBulkDelete]);

  const handleExportCsv = React.useCallback(() => {
    const targetRows = someSelected ? rows.filter((r) => selected.has(r._id)) : rows;
    const headers = ['Name', 'Client', 'Status', 'Start', 'End', 'Budget', 'Completion %', 'Owner'];
    const exportData = targetRows.map((p) => ({
      Name: p.name || p.projectName || '',
      Client: p.clientName || '',
      Status: p.status || '',
      Start: fmtDate(p.startDate),
      End: fmtDate(p.deadline ?? p.endDate),
      Budget: typeof (p.projectBudget ?? p.budget) === 'number'
        ? String(p.projectBudget ?? p.budget)
        : '',
      'Completion %': String(Number(p.completionPercent ?? p.progress ?? 0)),
      Owner: p.managerName || '',
    }));
    downloadCsv(`projects-${dateStamp()}.csv`, headers, exportData);
  }, [rows, selected, someSelected]);

  const handleExportXlsx = React.useCallback(async () => {
    const targetRows = someSelected ? rows.filter((r) => selected.has(r._id)) : rows;
    const headers = ['Name', 'Client', 'Status', 'Start', 'End', 'Budget', 'Completion %', 'Owner'];
    const exportData = targetRows.map((p) => ({
      Name: p.name || p.projectName || '',
      Client: p.clientName || '',
      Status: p.status || '',
      Start: fmtDate(p.startDate),
      End: fmtDate(p.deadline ?? p.endDate),
      Budget: typeof (p.projectBudget ?? p.budget) === 'number'
        ? String(p.projectBudget ?? p.budget)
        : '',
      'Completion %': String(Number(p.completionPercent ?? p.progress ?? 0)),
      Owner: p.managerName || '',
    }));
    await downloadXlsx(`projects-${dateStamp()}.xlsx`, headers, exportData, 'Projects');
  }, [rows, selected, someSelected]);

  if (rows.length === 0 && !loading) {
    return (
      <div className="rounded-lg border border-zoru-line p-6 text-center text-[13px] text-zoru-ink-muted">
        No projects match the current filters.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Bulk action bar — shown only when rows are selected */}
      {someSelected ? (
        <div
          role="region"
          aria-label="Bulk actions"
          className="flex items-center justify-between rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2"
        >
          <span className="text-sm text-zoru-ink">
            {selected.size} project{selected.size === 1 ? '' : 's'} selected
          </span>
          <div className="flex items-center gap-2">
            <ZoruButton
              size="sm"
              variant="outline"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </ZoruButton>
            <ZoruButton
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </ZoruButton>
            <ZoruButton
              size="sm"
              variant="outline"
              onClick={handleExportXlsx}
            >
              <Download className="h-3.5 w-3.5" /> XLSX
            </ZoruButton>
            <ZoruButton
              size="sm"
              variant="outline"
              onClick={handleBulkArchive}
            >
              <Archive className="h-3.5 w-3.5" /> Archive
            </ZoruButton>
            <ZoruButton
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </ZoruButton>
          </div>
        </div>
      ) : (
        /* When nothing is selected, show export for all rows */
        <div className="flex justify-end gap-2">
          <ZoruButton size="sm" variant="ghost" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" /> CSV
          </ZoruButton>
          <ZoruButton size="sm" variant="ghost" onClick={handleExportXlsx}>
            <Download className="h-3.5 w-3.5" /> XLSX
          </ZoruButton>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-zoru-line">
        <ZoruTable>
          <ZoruTableHeader>
            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
              <ZoruTableHead className="w-10">
                <ZoruCheckbox
                  aria-label="Select all projects"
                  checked={allSelected}
                  onCheckedChange={(v) => toggleAll(Boolean(v))}
                />
              </ZoruTableHead>
              <ZoruTableHead>Name</ZoruTableHead>
              <ZoruTableHead>Client</ZoruTableHead>
              <ZoruTableHead>Start</ZoruTableHead>
              <ZoruTableHead>End</ZoruTableHead>
              <ZoruTableHead className="text-right">Budget</ZoruTableHead>
              <ZoruTableHead>Billable</ZoruTableHead>
              <ZoruTableHead>Status</ZoruTableHead>
              <ZoruTableHead>% Complete</ZoruTableHead>
              <ZoruTableHead>Owner</ZoruTableHead>
              <ZoruTableHead className="text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {rows.map((p) => {
              const overdue = isOverdue(p);
              const pct = Number(p.completionPercent ?? p.progress ?? 0);
              const priority = (p.priority ?? '').toLowerCase();
              const isChecked = selected.has(p._id);
              return (
                <ZoruTableRow
                  key={p._id}
                  className={[
                    'border-zoru-line transition-colors',
                    overdue ? 'border-l-2 border-l-zoru-danger' : '',
                    isChecked ? 'bg-zoru-surface' : '',
                  ].join(' ')}
                >
                  <ZoruTableCell>
                    <ZoruCheckbox
                      aria-label={`Select ${p.name || p.projectName || 'project'}`}
                      checked={isChecked}
                      onCheckedChange={() => toggleOne(p._id)}
                    />
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <EntityRowLink
                      href={`/dashboard/crm/projects/${p._id}`}
                      label={p.name || p.projectName || 'Untitled'}
                    />
                    {p.priority ? (
                      <span className="ml-2 inline-block">
                        <StatusPill
                          label={p.priority}
                          tone={PRIORITY_TONE[priority] ?? 'neutral'}
                        />
                      </span>
                    ) : null}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    {p.clientId ? (
                      <EntityPickerChip
                        entity="client"
                        id={String(p.clientId)}
                        fallback={p.clientName || '—'}
                      />
                    ) : (
                      <span className="text-[12px] text-zoru-ink-muted">
                        {p.clientName || '—'}
                      </span>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {fmtDate(p.startDate)}
                  </ZoruTableCell>
                  <ZoruTableCell
                    className={[
                      'text-[12.5px]',
                      overdue ? 'text-zoru-danger' : 'text-zoru-ink-muted',
                    ].join(' ')}
                  >
                    {fmtDate(p.deadline ?? p.endDate)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right text-[12.5px] text-zoru-ink">
                    {fmtMoney(
                      Number(p.projectBudget ?? p.budget ?? 0) || null,
                      p.currency ?? 'INR',
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {p.hoursAllocated ? `${p.hoursAllocated}h` : '—'}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <StatusPill
                      label={p.status || 'not started'}
                      tone={statusToTone(p.status || '')}
                    />
                  </ZoruTableCell>
                  <ZoruTableCell className="min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <ZoruProgress value={pct} className="h-1.5 w-16" />
                      <span className="text-[12px] tabular-nums text-zoru-ink-muted">
                        {pct}%
                      </span>
                    </div>
                  </ZoruTableCell>
                  <ZoruTableCell>
                    {p.projectAdmin ? (
                      <EntityPickerChip
                        entity="user"
                        id={String(p.projectAdmin)}
                        fallback={p.managerName || '—'}
                      />
                    ) : (
                      <span className="text-[12px] text-zoru-ink-muted">
                        {p.managerName || '—'}
                      </span>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <ZoruDropdownMenu>
                      <ZoruDropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Actions for ${p.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </ZoruDropdownMenuTrigger>
                      <ZoruDropdownMenuContent align="end">
                        <ZoruDropdownMenuItem asChild>
                          <Link href={`/dashboard/crm/projects/${p._id}`}>
                            <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem asChild>
                          <Link href={`/dashboard/crm/projects/${p._id}`}>
                            <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                          </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem
                          onClick={() => onDelete(p._id)}
                          className="text-zoru-danger"
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                        </ZoruDropdownMenuItem>
                      </ZoruDropdownMenuContent>
                    </ZoruDropdownMenu>
                  </ZoruTableCell>
                </ZoruTableRow>
              );
            })}
          </ZoruTableBody>
        </ZoruTable>
      </div>
    </div>
  );
}
