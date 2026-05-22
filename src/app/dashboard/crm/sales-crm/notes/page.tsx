'use client';

/**
 * Lead Notes — Deep list page.
 *
 * Flat list of every note attached to a lead. Note titles open a
 * `<RowDrawer/>` (since notes lack a standalone detail page).
 *
 * KPIs (`getLeadNoteKpis`):
 *   - Total notes
 *   - Distinct leads with notes
 *   - Recent (7d)
 *   - By tag (top tags surfaced as chips)
 *
 * Filters: search, tag, lead_id, date range.
 * Bulk: delete, archive, CSV/XLSX export.
 *
 * Multi-tenant via `getSession()` in `hrList` / `hrSave` / `hrDelete`.
 */

import * as React from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  X,
  Download,
  FileSpreadsheet,
  Archive,
  StickyNote,
  Target,
  Clock,
  Tag,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { RowDrawer } from '@/components/crm/row-drawer';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityFormField } from '@/components/crm/entity-form-field';

import {
  getLeadNotes,
  saveLeadNote,
  deleteLeadNote,
  bulkDeleteLeadNotes,
  bulkArchiveLeadNotes,
  getLeadNoteKpis,
  type LeadNoteKpis,
} from '@/app/actions/worksuite/crm-plus.actions';
import { lookupEntity } from '@/app/actions/crm-lookup.actions';
import type { WsLeadNote } from '@/lib/worksuite/crm-types';
import {
  downloadCsv,
  downloadXlsx,
  dateStamp,
  type ExportRow,
} from '@/lib/crm-list-export';

const PAGE_SIZE = 25;

type Row = WsLeadNote & {
  _id: string;
  archived?: boolean;
};

function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function parseTags(input: string): string[] {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function LeadNotesPage() {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [kpis, setKpis] = React.useState<LeadNoteKpis | null>(null);
  const [leadLabels, setLeadLabels] = React.useState<
    Record<string, string>
  >({});

  const [isLoading, startLoad] = React.useTransition();
  const [isMutating, startMutate] = React.useTransition();

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [title, setTitle] = React.useState('');
  const [details, setDetails] = React.useState('');
  const [leadId, setLeadId] = React.useState('');
  const [tagsInput, setTagsInput] = React.useState('');

  const [confirmState, setConfirmState] = React.useState<
    | { kind: 'delete'; id: string; label: string }
    | { kind: 'bulkDelete' }
    | { kind: 'bulkArchive' }
    | null
  >(null);

  // filters
  const [q, setQ] = React.useState('');
  const [tagFilter, setTagFilter] = React.useState('');
  const [leadFilter, setLeadFilter] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [page, setPage] = React.useState(1);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const loadAll = React.useCallback(() => {
    startLoad(async () => {
      const [list, k] = await Promise.all([
        getLeadNotes(),
        getLeadNoteKpis(),
      ]);
      const rs = list as unknown as Row[];
      setRows(rs);
      setKpis(k);

      const uniqueIds = Array.from(
        new Set(rs.map((r) => String(r.lead_id)).filter(Boolean)),
      );
      if (uniqueIds.length > 0) {
        const lr = await lookupEntity('lead', { ids: uniqueIds });
        const map: Record<string, string> = {};
        for (const it of lr.items) map[it.id] = it.chip.primary;
        setLeadLabels(map);
      } else {
        setLeadLabels({});
      }
    });
  }, []);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  const leadOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; label: string }[] = [];
    for (const r of rows) {
      const id = String(r.lead_id ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, label: leadLabels[id] ?? id });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [rows, leadLabels]);

  const allTags = React.useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) {
      if (Array.isArray(r.tags)) {
        for (const t of r.tags) {
          const tag = String(t).trim();
          if (!tag) continue;
          seen.set(tag, (seen.get(tag) ?? 0) + 1);
        }
      }
    }
    return Array.from(seen.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
  }, [rows]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null;
    return rows.filter((r) => {
      if (needle) {
        const blob = [
          r.title,
          r.details,
          (r.tags ?? []).join(' '),
          leadLabels[String(r.lead_id)] ?? '',
        ]
          .map((x) => String(x ?? '').toLowerCase())
          .join(' ');
        if (!blob.includes(needle)) return false;
      }
      if (tagFilter) {
        const tags = (r.tags ?? []).map((t) => String(t));
        if (!tags.includes(tagFilter)) return false;
      }
      if (leadFilter && String(r.lead_id) !== leadFilter) return false;
      if (fromTs || toTs) {
        const t = new Date(String(r.createdAt ?? 0)).getTime();
        if (fromTs && t < fromTs) return false;
        if (toTs && t > toTs) return false;
      }
      return true;
    });
  }, [rows, q, tagFilter, leadFilter, from, to, leadLabels]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = React.useMemo(
    () => filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE),
    [filtered, pageSafe],
  );

  React.useEffect(() => {
    setPage(1);
  }, [q, tagFilter, leadFilter, from, to]);

  const openNew = () => {
    setEditing(null);
    setTitle('');
    setDetails('');
    setLeadId('');
    setTagsInput('');
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setTitle(r.title);
    setDetails(r.details ?? '');
    setLeadId(String(r.lead_id));
    setTagsInput((r.tags ?? []).join(', '));
    setOpen(true);
  };

  const handleSave = () => {
    if (!title.trim() || !leadId) return;
    const fd = new FormData();
    if (editing) fd.append('_id', editing._id);
    fd.append('lead_id', leadId);
    fd.append('title', title.trim());
    fd.append('details', details);
    fd.append('tags', JSON.stringify(parseTags(tagsInput)));
    startMutate(async () => {
      const r = await saveLeadNote(undefined, fd);
      if (r.error) {
        toast({
          title: 'Error',
          description: r.error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Saved' });
      setOpen(false);
      loadAll();
    });
  };

  const handleDelete = (id: string) => {
    startMutate(async () => {
      const r = await deleteLeadNote(id);
      if (r.success) {
        toast({ title: 'Deleted' });
        setSelected((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        loadAll();
      } else {
        toast({
          title: 'Error',
          description: r.error,
          variant: 'destructive',
        });
      }
    });
  };
  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    startMutate(async () => {
      const r = await bulkDeleteLeadNotes(ids);
      toast({
        title: r.success ? 'Deleted' : 'Error',
        description: r.success ? `${r.deleted} note(s) removed` : r.error,
        variant: r.success ? 'default' : 'destructive',
      });
      setSelected(new Set());
      loadAll();
    });
  };
  const handleBulkArchive = () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    startMutate(async () => {
      const r = await bulkArchiveLeadNotes(ids);
      toast({
        title: r.success ? 'Archived' : 'Error',
        description: r.success ? `${r.archived} note(s) archived` : r.error,
        variant: r.success ? 'default' : 'destructive',
      });
      setSelected(new Set());
      loadAll();
    });
  };

  const toggleAllOnPage = (checked: boolean) => {
    setSelected((s) => {
      const next = new Set(s);
      for (const r of pageRows) {
        if (checked) next.add(r._id);
        else next.delete(r._id);
      }
      return next;
    });
  };
  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r._id));

  const buildExport = (): { headers: string[]; rows: ExportRow[] } => {
    const headers = ['Title', 'Lead', 'Tags', 'Details', 'Created At'];
    const out: ExportRow[] = filtered.map((r) => ({
      Title: r.title,
      Lead: leadLabels[String(r.lead_id)] ?? String(r.lead_id),
      Tags: (r.tags ?? []).join(', '),
      Details: r.details ?? '',
      'Created At': r.createdAt ? String(r.createdAt).slice(0, 10) : '',
    }));
    return { headers, rows: out };
  };
  const onExportCsv = () => {
    const { headers, rows: out } = buildExport();
    downloadCsv(`lead-notes-${dateStamp()}.csv`, headers, out);
  };
  const onExportXlsx = () => {
    const { headers, rows: out } = buildExport();
    void downloadXlsx(
      `lead-notes-${dateStamp()}.xlsx`,
      headers,
      out,
      'Notes',
    );
  };

  const topTagsHint = React.useMemo(() => {
    const entries = Object.entries(kpis?.byTag ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (entries.length === 0) return 'No tags yet';
    return entries.map(([t, n]) => `${t}: ${n}`).join(' · ');
  }, [kpis]);

  return (
    <EntityListShell
      title="Lead Notes"
      subtitle="Flat list of every note attached to a lead."
      search={{
        value: q,
        onChange: setQ,
        placeholder: 'Search notes…',
      }}
      primaryAction={
        <div className="flex items-center gap-2">
          <ZoruButton variant="outline" size="sm" onClick={onExportCsv}>
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            CSV
          </ZoruButton>
          <ZoruButton variant="outline" size="sm" onClick={onExportXlsx}>
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} />
            XLSX
          </ZoruButton>
          <ZoruButton onClick={openNew}>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Add Note
          </ZoruButton>
        </div>
      }
      filters={
        <>
          <div className="w-40">
            <ZoruSelect
              value={tagFilter || 'all'}
              onValueChange={(v) => setTagFilter(v === 'all' ? '' : v)}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Tag" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All tags</ZoruSelectItem>
                {allTags.map((t) => (
                  <ZoruSelectItem key={t} value={t}>
                    {t}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="w-56">
            <ZoruSelect
              value={leadFilter || 'all'}
              onValueChange={(v) => setLeadFilter(v === 'all' ? '' : v)}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Lead" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All leads</ZoruSelectItem>
                {leadOptions.map((l) => (
                  <ZoruSelectItem key={l.id} value={l.id}>
                    {l.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="flex items-center gap-2">
            <ZoruLabel className="text-[12px] text-zoru-ink-muted">
              From
            </ZoruLabel>
            <ZoruInput
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-[160px]"
            />
            <ZoruLabel className="text-[12px] text-zoru-ink-muted">
              To
            </ZoruLabel>
            <ZoruInput
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 w-[160px]"
            />
          </div>
        </>
      }
      bulkBar={
        selected.size > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-zoru-ink-muted">
              {selected.size} selected
            </span>
            <div className="flex items-center gap-2">
              <ZoruButton
                variant="outline"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </ZoruButton>
              <ZoruButton
                variant="outline"
                size="sm"
                onClick={onExportCsv}
              >
                <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                Export CSV
              </ZoruButton>
              <ZoruButton
                variant="outline"
                size="sm"
                onClick={() => setConfirmState({ kind: 'bulkArchive' })}
                disabled={isMutating}
              >
                <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />
                Archive
              </ZoruButton>
              <ZoruButton
                variant="outline"
                size="sm"
                onClick={() => setConfirmState({ kind: 'bulkDelete' })}
                disabled={isMutating}
              >
                <Trash2
                  className="h-3.5 w-3.5 text-red-500"
                  strokeWidth={1.75}
                />
                Delete
              </ZoruButton>
            </div>
          </div>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-4">
          <KpiCard
            icon={<StickyNote className="h-4 w-4" />}
            label="Total notes"
            value={(kpis?.total ?? 0).toLocaleString('en-IN')}
            hint="All lead notes"
          />
          <KpiCard
            icon={<Target className="h-4 w-4" />}
            label="By lead"
            value={(kpis?.byLead ?? 0).toLocaleString('en-IN')}
            hint="Distinct leads with at least 1 note"
          />
          <KpiCard
            icon={<Clock className="h-4 w-4" />}
            label="Recent (7d)"
            value={(kpis?.recent7d ?? 0).toLocaleString('en-IN')}
            hint="Created in last 7 days"
          />
          <KpiCard
            icon={<Tag className="h-4 w-4" />}
            label="By tag"
            value={String(Object.keys(kpis?.byTag ?? {}).length)}
            hint={topTagsHint}
          />
        </div>

        <ZoruCard className="p-0">
          {isLoading && rows.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
              {rows.length === 0
                ? 'No notes yet. Add one above.'
                : 'No notes match the current filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-zoru-line bg-zoru-surface-2">
                    <th className="w-10 px-3 py-3">
                      <ZoruCheckbox
                        checked={allOnPageSelected}
                        onCheckedChange={(c) =>
                          toggleAllOnPage(Boolean(c))
                        }
                        aria-label="Select all on page"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Title
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Lead
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Tags
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Details
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-zoru-ink-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => {
                    const isSel = selected.has(r._id);
                    const leadLabel =
                      leadLabels[String(r.lead_id)] ??
                      String(r.lead_id ?? '—');
                    const preview = (r.details ?? '').slice(0, 80);
                    const tags = r.tags ?? [];
                    return (
                      <tr
                        key={r._id}
                        className="border-b border-zoru-line last:border-0"
                      >
                        <td className="px-3 py-3">
                          <ZoruCheckbox
                            checked={isSel}
                            onCheckedChange={(c) => {
                              setSelected((s) => {
                                const next = new Set(s);
                                if (c) next.add(r._id);
                                else next.delete(r._id);
                                return next;
                              });
                            }}
                            aria-label={`Select ${r.title}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <RowDrawer
                            label={r.title}
                            subtitle={
                              tags.length > 0
                                ? tags.slice(0, 2).join(', ')
                                : undefined
                            }
                            title={r.title}
                            description={`Lead: ${leadLabel}`}
                            width="md"
                          >
                            <NoteDrawerBody note={r} leadLabel={leadLabel} />
                          </RowDrawer>
                        </td>
                        <td className="px-4 py-3">
                          {r.lead_id ? (
                            <EntityRowLink
                              href={`/dashboard/crm/sales-crm/leads/${String(r.lead_id)}`}
                              label={leadLabel}
                            />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {tags.length === 0 ? (
                            <span className="text-zoru-ink-muted">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {tags.slice(0, 3).map((t) => (
                                <ZoruBadge
                                  key={t}
                                  variant="ghost"
                                  className="text-[11px]"
                                >
                                  {t}
                                </ZoruBadge>
                              ))}
                              {tags.length > 3 ? (
                                <span className="text-[11px] text-zoru-ink-muted">
                                  +{tags.length - 3}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zoru-ink-muted">
                          {preview
                            ? preview.length <
                              (r.details ?? '').length
                              ? `${preview}…`
                              : preview
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-zoru-ink-muted">
                          {formatDate(r.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <ZoruButton
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(r)}
                            >
                              <Pencil
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                              Edit
                            </ZoruButton>
                            <ZoruButton
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setConfirmState({
                                  kind: 'delete',
                                  id: r._id,
                                  label: r.title,
                                })
                              }
                              disabled={isMutating}
                            >
                              <Trash2
                                className="h-3.5 w-3.5 text-red-500"
                                strokeWidth={1.75}
                              />
                              Delete
                            </ZoruButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-3 border-t border-zoru-line px-3 py-2.5 text-[12.5px] text-zoru-ink-muted">
              <span>
                Page {pageSafe} of {totalPages} · {filtered.length} notes
              </span>
              <div className="flex items-center gap-1">
                <ZoruButton
                  variant="outline"
                  size="sm"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  disabled={pageSafe >= totalPages}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  Next
                </ZoruButton>
              </div>
            </div>
          ) : null}
        </ZoruCard>
      </div>

      {/* Add/Edit modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <ZoruCard className="w-full max-w-xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] text-zoru-ink">
                {editing ? 'Edit Note' : 'Add Note'}
              </h2>
              <ZoruButton
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
                Close
              </ZoruButton>
            </div>
            <div className="grid gap-3">
              <div>
                <ZoruLabel>Lead *</ZoruLabel>
                <div className="mt-1.5">
                  <EntityFormField
                    entity="lead"
                    name="lead_id"
                    initialId={leadId || null}
                    initialLabel={leadLabels[leadId] ?? ''}
                    onChange={(next) => setLeadId(next ?? '')}
                    allowCreate
                    placeholder="Select or create a lead…"
                  />
                </div>
              </div>
              <div>
                <ZoruLabel>Title *</ZoruLabel>
                <ZoruInput
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <ZoruLabel>Tags (comma-separated)</ZoruLabel>
                <ZoruInput
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="mt-1.5"
                  placeholder="follow-up, demo, hot"
                />
              </div>
              <div>
                <ZoruLabel>Details</ZoruLabel>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={5}
                  className="mt-1.5 w-full rounded-md border border-zoru-line bg-zoru-bg px-3 py-2 text-[13px] text-zoru-ink outline-none focus-visible:border-zoru-primary"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <ZoruButton
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </ZoruButton>
                <ZoruButton
                  onClick={handleSave}
                  disabled={isMutating || !title.trim() || !leadId}
                >
                  {isMutating ? (
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      strokeWidth={1.75}
                    />
                  ) : null}
                  {editing ? 'Update' : 'Create'}
                </ZoruButton>
              </div>
            </div>
          </ZoruCard>
        </div>
      )}

      <ConfirmDialog
        open={confirmState?.kind === 'delete'}
        onOpenChange={(o) => {
          if (!o) setConfirmState(null);
        }}
        title="Delete note?"
        description={
          confirmState?.kind === 'delete'
            ? `Remove "${confirmState.label}". This action cannot be undone.`
            : ''
        }
        onConfirm={async () => {
          if (confirmState?.kind === 'delete') handleDelete(confirmState.id);
        }}
      />
      <ConfirmDialog
        open={confirmState?.kind === 'bulkDelete'}
        onOpenChange={(o) => {
          if (!o) setConfirmState(null);
        }}
        title={`Delete ${selected.size} note${
          selected.size === 1 ? '' : 's'
        }?`}
        description="This permanently removes the selected notes."
        requireTyped="DELETE"
        onConfirm={async () => handleBulkDelete()}
      />
      <ConfirmDialog
        open={confirmState?.kind === 'bulkArchive'}
        onOpenChange={(o) => {
          if (!o) setConfirmState(null);
        }}
        title={`Archive ${selected.size} note${
          selected.size === 1 ? '' : 's'
        }?`}
        description="Archived notes remain in the database but hide from the default view."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => handleBulkArchive()}
      />
    </EntityListShell>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <ZoruCard className="p-5">
      <div className="flex items-center gap-2 text-zoru-ink-muted">
        {icon}
        <p className="text-[12.5px] font-medium">{label}</p>
      </div>
      <div className="mt-2 truncate text-2xl text-zoru-ink" title={value}>
        {value}
      </div>
      {hint ? (
        <p
          className="mt-1 truncate text-[11.5px] text-zoru-ink-muted"
          title={hint}
        >
          {hint}
        </p>
      ) : null}
    </ZoruCard>
  );
}

function NoteDrawerBody({
  note,
  leadLabel,
}: {
  note: WsLeadNote & { _id: string };
  leadLabel: string;
}) {
  const tags = note.tags ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink-muted">
        <Target className="h-3.5 w-3.5" />
        <span>{leadLabel}</span>
      </div>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <ZoruBadge key={t} variant="ghost" className="text-[11px]">
              {t}
            </ZoruBadge>
          ))}
        </div>
      ) : null}
      <div className="whitespace-pre-wrap text-[13px] leading-6 text-zoru-ink">
        {note.details || (
          <span className="text-zoru-ink-muted">No details.</span>
        )}
      </div>
      <div className="border-t border-zoru-line pt-3 text-[12px] text-zoru-ink-muted">
        Created{' '}
        {note.createdAt
          ? new Date(String(note.createdAt)).toLocaleString()
          : '—'}
      </div>
    </div>
  );
}
