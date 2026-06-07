'use client';

import { Button, Checkbox, Table, TBody, Td, Th, THead, Tr, Progress, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/sabcrm/20ui';
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
      <div className="rounded-lg border border-[var(--st-border)] p-6 text-center text-[13px] text-[var(--st-text-secondary)]">
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
          className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
        >
          <span className="text-sm text-[var(--st-text)]">
            {selected.size} project{selected.size === 1 ? '' : 's'} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportXlsx}
            >
              <Download className="h-3.5 w-3.5" /> XLSX
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkArchive}
            >
              <Archive className="h-3.5 w-3.5" /> Archive
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>
      ) : (
        /* When nothing is selected, show export for all rows */
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" variant="ghost" onClick={handleExportXlsx}>
            <Download className="h-3.5 w-3.5" /> XLSX
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
        <Table>
          <THead>
            <Tr className="border-[var(--st-border)] hover:bg-transparent">
              <Th className="w-10">
                <Checkbox
                  aria-label="Select all projects"
                  checked={allSelected}
                  onCheckedChange={(v) => toggleAll(Boolean(v))}
                />
              </Th>
              <Th>Name</Th>
              <Th>Client</Th>
              <Th>Start</Th>
              <Th>End</Th>
              <Th className="text-right">Budget</Th>
              <Th>Billable</Th>
              <Th>Status</Th>
              <Th>% Complete</Th>
              <Th>Owner</Th>
              <Th className="text-right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((p) => {
              const overdue = isOverdue(p);
              const pct = Number(p.completionPercent ?? p.progress ?? 0);
              const priority = (p.priority ?? '').toLowerCase();
              const isChecked = selected.has(p._id);
              return (
                <Tr
                  key={p._id}
                  className={[
                    'border-[var(--st-border)] transition-colors',
                    overdue ? 'border-l-2 border-l-[var(--st-danger)]' : '',
                    isChecked ? 'bg-[var(--st-bg-secondary)]' : '',
                  ].join(' ')}
                >
                  <Td>
                    <Checkbox
                      aria-label={`Select ${p.name || p.projectName || 'project'}`}
                      checked={isChecked}
                      onCheckedChange={() => toggleOne(p._id)}
                    />
                  </Td>
                  <Td>
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
                  </Td>
                  <Td>
                    {p.clientId ? (
                      <EntityPickerChip
                        entity="client"
                        id={String(p.clientId)}
                        fallback={p.clientName || '—'}
                      />
                    ) : (
                      <span className="text-[12px] text-[var(--st-text-secondary)]">
                        {p.clientName || '—'}
                      </span>
                    )}
                  </Td>
                  <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                    {fmtDate(p.startDate)}
                  </Td>
                  <Td
                    className={[
                      'text-[12.5px]',
                      overdue ? 'text-[var(--st-danger)]' : 'text-[var(--st-text-secondary)]',
                    ].join(' ')}
                  >
                    {fmtDate(p.deadline ?? p.endDate)}
                  </Td>
                  <Td className="text-right text-[12.5px] text-[var(--st-text)]">
                    {fmtMoney(
                      Number(p.projectBudget ?? p.budget ?? 0) || null,
                      p.currency ?? 'INR',
                    )}
                  </Td>
                  <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                    {p.hoursAllocated ? `${p.hoursAllocated}h` : '—'}
                  </Td>
                  <Td>
                    <StatusPill
                      label={p.status || 'not started'}
                      tone={statusToTone(p.status || '')}
                    />
                  </Td>
                  <Td className="min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="h-1.5 w-16" />
                      <span className="text-[12px] tabular-nums text-[var(--st-text-secondary)]">
                        {pct}%
                      </span>
                    </div>
                  </Td>
                  <Td>
                    {p.projectAdmin ? (
                      <EntityPickerChip
                        entity="user"
                        id={String(p.projectAdmin)}
                        fallback={p.managerName || '—'}
                      />
                    ) : (
                      <span className="text-[12px] text-[var(--st-text-secondary)]">
                        {p.managerName || '—'}
                      </span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Actions for ${p.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/crm/projects/${p._id}`}>
                            <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/crm/projects/${p._id}`}>
                            <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(p._id)}
                          className="text-[var(--st-danger)]"
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
