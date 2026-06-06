'use client';

/**
 * Client Notes — Deep list page.
 *
 * Flat list of every note attached to a client account. Note titles
 * open a `<RowDrawer/>` (since notes lack a standalone detail page).
 *
 * KPIs (`getClientNoteKpis`):
 *   - Total notes
 *   - Distinct clients with notes
 *   - Recent (7d)
 *   - Pinned count
 *
 * Filters: search, status (pinned/unpinned), client_id, date range.
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
  Building2,
  Clock,
  Pin,
} from 'lucide-react';

import { Badge, Button, Card, Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@/components/sabcrm/20ui/compat';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { RowDrawer } from '@/components/crm/row-drawer';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityFormField } from '@/components/crm/entity-form-field';

import {
  getClientNotes,
  saveClientNote,
  deleteClientNote,
  bulkDeleteClientNotes,
  bulkArchiveClientNotes,
  getClientNoteKpis,
  type ClientNoteKpis,
} from '@/app/actions/worksuite/crm-plus.actions';
import { lookupEntity } from '@/app/actions/crm-lookup.actions';
import type { WsClientNote } from '@/lib/worksuite/crm-types';
import {
  downloadCsv,
  downloadXlsx,
  dateStamp,
  type ExportRow,
} from '@/lib/crm-list-export';

const PAGE_SIZE = 25;

type Row = WsClientNote & {
  _id: string;
  archived?: boolean;
};

function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export default function ClientNotesPage() {
  const { toast } = useToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [kpis, setKpis] = React.useState<ClientNoteKpis | null>(null);
  const [clientLabels, setClientLabels] = React.useState<
    Record<string, string>
  >({});

  const [isLoading, startLoad] = React.useTransition();
  const [isMutating, startMutate] = React.useTransition();

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [title, setTitle] = React.useState('');
  const [details, setDetails] = React.useState('');
  const [clientId, setClientId] = React.useState('');
  const [pinned, setPinned] = React.useState<'yes' | 'no'>('no');

  const [confirmState, setConfirmState] = React.useState<
    | { kind: 'delete'; id: string; label: string }
    | { kind: 'bulkDelete' }
    | { kind: 'bulkArchive' }
    | null
  >(null);

  // filters
  const [q, setQ] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<
    'all' | 'pinned' | 'unpinned'
  >('all');
  const [clientFilter, setClientFilter] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [page, setPage] = React.useState(1);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const loadAll = React.useCallback(() => {
    startLoad(async () => {
      const [list, k] = await Promise.all([
        getClientNotes(),
        getClientNoteKpis(),
      ]);
      const rs = list as unknown as Row[];
      setRows(rs);
      setKpis(k);

      const uniqueIds = Array.from(
        new Set(rs.map((r) => String(r.client_id)).filter(Boolean)),
      );
      if (uniqueIds.length > 0) {
        const lr = await lookupEntity('client', { ids: uniqueIds });
        const map: Record<string, string> = {};
        for (const it of lr.items) map[it.id] = it.chip.primary;
        setClientLabels(map);
      } else {
        setClientLabels({});
      }
    });
  }, []);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  const clientOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; label: string }[] = [];
    for (const r of rows) {
      const id = String(r.client_id ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, label: clientLabels[id] ?? id });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [rows, clientLabels]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null;
    return rows.filter((r) => {
      if (needle) {
        const blob = [
          r.title,
          r.details,
          clientLabels[String(r.client_id)] ?? '',
        ]
          .map((x) => String(x ?? '').toLowerCase())
          .join(' ');
        if (!blob.includes(needle)) return false;
      }
      if (statusFilter === 'pinned' && !r.pinned) return false;
      if (statusFilter === 'unpinned' && r.pinned) return false;
      if (clientFilter && String(r.client_id) !== clientFilter) return false;
      if (fromTs || toTs) {
        const t = new Date(String(r.createdAt ?? 0)).getTime();
        if (fromTs && t < fromTs) return false;
        if (toTs && t > toTs) return false;
      }
      return true;
    });
  }, [rows, q, statusFilter, clientFilter, from, to, clientLabels]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = React.useMemo(
    () => filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE),
    [filtered, pageSafe],
  );

  React.useEffect(() => {
    setPage(1);
  }, [q, statusFilter, clientFilter, from, to]);

  const openNew = () => {
    setEditing(null);
    setTitle('');
    setDetails('');
    setClientId('');
    setPinned('no');
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setTitle(r.title);
    setDetails(r.details ?? '');
    setClientId(String(r.client_id));
    setPinned(r.pinned ? 'yes' : 'no');
    setOpen(true);
  };

  const handleSave = () => {
    if (!title.trim() || !clientId) return;
    const fd = new FormData();
    if (editing) fd.append('_id', editing._id);
    fd.append('client_id', clientId);
    fd.append('title', title.trim());
    fd.append('details', details);
    fd.append('pinned', pinned);
    startMutate(async () => {
      const r = await saveClientNote(undefined, fd);
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
      const r = await deleteClientNote(id);
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
      const r = await bulkDeleteClientNotes(ids);
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
      const r = await bulkArchiveClientNotes(ids);
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
    const headers = ['Title', 'Client', 'Pinned', 'Details', 'Created At'];
    const out: ExportRow[] = filtered.map((r) => ({
      Title: r.title,
      Client: clientLabels[String(r.client_id)] ?? String(r.client_id),
      Pinned: r.pinned ? 'Yes' : 'No',
      Details: r.details ?? '',
      'Created At': r.createdAt ? String(r.createdAt).slice(0, 10) : '',
    }));
    return { headers, rows: out };
  };
  const onExportCsv = () => {
    const { headers, rows: out } = buildExport();
    downloadCsv(`client-notes-${dateStamp()}.csv`, headers, out);
  };
  const onExportXlsx = () => {
    const { headers, rows: out } = buildExport();
    void downloadXlsx(
      `client-notes-${dateStamp()}.xlsx`,
      headers,
      out,
      'Notes',
    );
  };

  return (
    <EntityListShell
      title="Client Notes"
      subtitle="Flat list of every note attached to a client account."
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
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as typeof statusFilter)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All notes</SelectItem>
                <SelectItem value="pinned">Pinned</SelectItem>
                <SelectItem value="unpinned">Unpinned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-56">
            <Select
              value={clientFilter || 'all'}
              onValueChange={(v) =>
                setClientFilter(v === 'all' ? '' : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clientOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
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
            hint="All client notes"
          />
          <KpiCard
            icon={<Building2 className="h-4 w-4" />}
            label="By client"
            value={(kpis?.byClient ?? 0).toLocaleString('en-IN')}
            hint="Distinct clients with at least 1 note"
          />
          <KpiCard
            icon={<Clock className="h-4 w-4" />}
            label="Recent (7d)"
            value={(kpis?.recent7d ?? 0).toLocaleString('en-IN')}
            hint="Created in last 7 days"
          />
          <KpiCard
            icon={<Pin className="h-4 w-4" />}
            label="Pinned"
            value={(kpis?.pinned ?? 0).toLocaleString('en-IN')}
            hint="Marked for quick reference"
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
                      Client
                    </th>
                    <th className="px-4 py-3 font-medium text-[var(--st-text-secondary)]">
                      Details
                    </th>
                    <th className="px-4 py-3 font-medium text-[var(--st-text-secondary)]">
                      Pinned
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
                    const clientLabel =
                      clientLabels[String(r.client_id)] ??
                      String(r.client_id ?? '—');
                    const preview = (r.details ?? '').slice(0, 80);
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
                            subtitle={r.pinned ? 'Pinned' : undefined}
                            title={r.title}
                            description={`Client: ${clientLabel}`}
                            width="md"
                          >
                            <NoteDrawerBody note={r} clientLabel={clientLabel} />
                          </RowDrawer>
                        </td>
                        <td className="px-4 py-3">
                          {r.client_id ? (
                            <EntityRowLink
                              href={`/dashboard/crm/sales/clients/${String(r.client_id)}`}
                              label={clientLabel}
                            />
                          ) : (
                            '—'
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
                        <td className="px-4 py-3">
                          {r.pinned ? (
                            <Badge variant="info">
                              <Pin
                                className="h-3 w-3"
                                strokeWidth={1.75}
                              />
                              Pinned
                            </Badge>
                          ) : (
                            <span className="text-[var(--st-text-secondary)]">—</span>
                          )}
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
                <Label>Client *</Label>
                <div className="mt-1.5">
                  <EntityFormField
                    entity="client"
                    name="client_id"
                    initialId={clientId || null}
                    initialLabel={clientLabels[clientId] ?? ''}
                    onChange={(next) => setClientId(next ?? '')}
                    allowCreate
                    placeholder="Select or create a client…"
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
                <Label>Details</Label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={5}
                  className="mt-1.5 w-full rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-[13px] text-[var(--st-text)] outline-none focus-visible:border-[var(--st-text)]"
                />
              </div>
              <div>
                <Label>Pinned</Label>
                <Select
                  value={pinned}
                  onValueChange={(v) => setPinned(v as 'yes' | 'no')}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
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
                  disabled={isMutating || !title.trim() || !clientId}
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
  clientLabel,
}: {
  note: WsClientNote & { _id: string };
  clientLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
        <Building2 className="h-3.5 w-3.5" />
        <span>{clientLabel}</span>
      </div>
      {note.pinned ? (
        <Badge variant="info" className="w-fit">
          <Pin className="h-3 w-3" strokeWidth={1.75} />
          Pinned
        </Badge>
      ) : null}
      <div className="whitespace-pre-wrap text-[13px] leading-6 text-[var(--st-text)]">
        {note.details || (
          <span className="text-[var(--st-text-secondary)]">No details.</span>
        )}
      </div>
      <div className="border-t border-[var(--st-border)] pt-3 text-[12px] text-[var(--st-text-secondary)]">
        Created{' '}
        {note.createdAt
          ? new Date(String(note.createdAt)).toLocaleString()
          : '—'}
      </div>
    </div>
  );
}
