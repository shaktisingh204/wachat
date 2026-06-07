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

import { Badge, Button, Card, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@/components/sabcrm/20ui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { RowDrawer } from '@/components/crm/row-drawer';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { RichTextMentionsEditor } from '@/components/crm/rich-text-mentions-editor';
import { marked } from 'marked';

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
  const { toast } = useToast();

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
  const [debouncedQ, setDebouncedQ] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const loadAll = React.useCallback(() => {
    startLoad(async () => {
      const k = await getLeadNoteKpis();
      setKpis(k);

      let skip = 0;
      const limit = 250;
      let allRows: Row[] = [];
      let uniqueLeadIds = new Set<string>();

      // Clear rows initially for new searches
      setRows([]);

      while (true) {
        const chunk = await getLeadNotes({ skip, limit, q: debouncedQ });
        const items = chunk.items as unknown as Row[];
        if (items.length === 0) break;
        
        allRows = [...allRows, ...items];
        items.forEach(r => {
          if (r.lead_id) uniqueLeadIds.add(String(r.lead_id));
        });
        
        setRows([...allRows]); // progressive UI update
        
        if (items.length < limit) break;
        skip += limit;
      }

      if (uniqueLeadIds.size > 0) {
        const lr = await lookupEntity('lead', { ids: Array.from(uniqueLeadIds) });
        const map: Record<string, string> = {};
        for (const it of lr.items) map[it.id] = it.chip.primary;
        setLeadLabels(map);
      } else {
        setLeadLabels({});
      }
    });
  }, [debouncedQ]);

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
    // Search needle logic removed because it is now done server-side via debouncedQ.
    // We only apply client side filters for tag, lead, from, to.
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null;
    return rows.filter((r) => {
      if (tagFilter && (!r.tags || !r.tags.includes(tagFilter))) return false;
      if (leadFilter && String(r.lead_id) !== leadFilter) return false;
      if (r.createdAt && (fromTs || toTs)) {
        const d = new Date(String(r.createdAt)).getTime();
        if (fromTs && d < fromTs) return false;
        if (toTs && d > toTs) return false;
      }
      return true;
    });
  }, [rows, tagFilter, leadFilter, from, to]);

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
          <Button variant="outline" size="sm" onClick={onExportCsv}>
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={onExportXlsx}>
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} />
            XLSX
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Add Note
          </Button>
        </div>
      }
      filters={
        <>
          <div className="w-40">
            <Select
              value={tagFilter || 'all'}
              onValueChange={(v) => setTagFilter(v === 'all' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {allTags.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-56">
            <Select
              value={leadFilter || 'all'}
              onValueChange={(v) => setLeadFilter(v === 'all' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Lead" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All leads</SelectItem>
                {leadOptions.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-[12px] text-[var(--st-text-secondary)]">
              From
            </Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-[160px]"
            />
            <Label className="text-[12px] text-[var(--st-text-secondary)]">
              To
            </Label>
            <Input
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
            <span className="text-[12.5px] text-[var(--st-text-secondary)]">
              {selected.size} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onExportCsv}
              >
                <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmState({ kind: 'bulkArchive' })}
                disabled={isMutating}
              >
                <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />
                Archive
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmState({ kind: 'bulkDelete' })}
                disabled={isMutating}
              >
                <Trash2
                  className="h-3.5 w-3.5 text-[var(--st-text)]"
                  strokeWidth={1.75}
                />
                Delete
              </Button>
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

        <Card className="p-0">
          {isLoading && rows.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-[var(--st-text-secondary)]">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-[var(--st-text-secondary)]">
              {rows.length === 0
                ? 'No notes yet. Add one above.'
                : 'No notes match the current filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                    <th className="w-10 px-3 py-3">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={(c) =>
                          toggleAllOnPage(Boolean(c))
                        }
                        aria-label="Select all on page"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium text-[var(--st-text-secondary)]">
                      Title
                    </th>
                    <th className="px-4 py-3 font-medium text-[var(--st-text-secondary)]">
                      Lead
                    </th>
                    <th className="px-4 py-3 font-medium text-[var(--st-text-secondary)]">
                      Tags
                    </th>
                    <th className="px-4 py-3 font-medium text-[var(--st-text-secondary)]">
                      Details
                    </th>
                    <th className="px-4 py-3 font-medium text-[var(--st-text-secondary)]">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-[var(--st-text-secondary)]">
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
                        className="border-b border-[var(--st-border)] last:border-0"
                      >
                        <td className="px-3 py-3">
                          <Checkbox
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
                            <span className="text-[var(--st-text-secondary)]">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {tags.slice(0, 3).map((t) => (
                                <Badge
                                  key={t}
                                  variant="ghost"
                                  className="text-[11px]"
                                >
                                  {t}
                                </Badge>
                              ))}
                              {tags.length > 3 ? (
                                <span className="text-[11px] text-[var(--st-text-secondary)]">
                                  +{tags.length - 3}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[var(--st-text-secondary)]">
                          {preview
                            ? preview.length <
                              (r.details ?? '').length
                              ? `${preview}…`
                              : preview
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-[var(--st-text-secondary)]">
                          {formatDate(r.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(r)}
                            >
                              <Pencil
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                              Edit
                            </Button>
                            <Button
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
                                className="h-3.5 w-3.5 text-[var(--st-text)]"
                                strokeWidth={1.75}
                              />
                              Delete
                            </Button>
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
            <div className="flex items-center justify-between gap-3 border-t border-[var(--st-border)] px-3 py-2.5 text-[12.5px] text-[var(--st-text-secondary)]">
              <span>
                Page {pageSafe} of {totalPages} · {filtered.length} notes
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pageSafe >= totalPages}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      {/* Add/Edit modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] text-[var(--st-text)]">
                {editing ? 'Edit Note' : 'Add Note'}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
                Close
              </Button>
            </div>
            <div className="grid gap-3">
              <div>
                <Label>Lead *</Label>
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
                <Label>Title *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="mt-1.5"
                  placeholder="follow-up, demo, hot"
                />
              </div>
              <div>
                <Label>Details</Label>
                <div className="mt-1.5">
                  <RichTextMentionsEditor
                    value={details}
                    onChange={setDetails}
                    placeholder="Type details or @mention someone..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
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
                </Button>
              </div>
            </div>
          </Card>
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
    <Card className="p-5">
      <div className="flex items-center gap-2 text-[var(--st-text-secondary)]">
        {icon}
        <p className="text-[12.5px] font-medium">{label}</p>
      </div>
      <div className="mt-2 truncate text-2xl text-[var(--st-text)]" title={value}>
        {value}
      </div>
      {hint ? (
        <p
          className="mt-1 truncate text-[11.5px] text-[var(--st-text-secondary)]"
          title={hint}
        >
          {hint}
        </p>
      ) : null}
    </Card>
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
      <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
        <Target className="h-3.5 w-3.5" />
        <span>{leadLabel}</span>
      </div>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <Badge key={t} variant="ghost" className="text-[11px]">
              {t}
            </Badge>
          ))}
        </div>
      ) : null}
      <div 
        className="prose prose-sm prose-ui20 max-w-none text-[13px] leading-6 text-[var(--st-text)]"
        dangerouslySetInnerHTML={{
          __html: note.details ? marked.parse(note.details) as string : '<span class="text-[var(--st-text-secondary)]">No details.</span>'
        }}
      />
      <div className="border-t border-[var(--st-border)] pt-3 text-[12px] text-[var(--st-text-secondary)]">
        Created{' '}
        {note.createdAt
          ? new Date(String(note.createdAt)).toLocaleString()
          : '—'}
      </div>
    </div>
  );
}
