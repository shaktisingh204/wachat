'use client';

/**
 * Client Documents — Deep list page.
 *
 * Lists every file uploaded against a client account with KPIs,
 * filters (search + type + client + date), bulk delete / archive,
 * and CSV / XLSX export.
 *
 * KPIs (`getClientDocumentKpis`):
 *   - Total docs
 *   - Counts by type (contract / invoice / proposal / kyc / other)
 *   - Recently uploaded (7d)
 *   - Total size on disk
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
  FileText,
  Files,
  Upload,
  HardDrive,
  ExternalLink,
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
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityFormField } from '@/components/crm/entity-form-field';

import {
  getClientDocuments,
  saveClientDocument,
  deleteClientDocument,
  bulkDeleteClientDocuments,
  bulkArchiveClientDocuments,
  getClientDocumentKpis,
  type ClientDocumentKpis,
} from '@/app/actions/worksuite/crm-plus.actions';
import { lookupEntity } from '@/app/actions/crm-lookup.actions';
import type {
  WsClientDocument,
  WsClientDocumentType,
} from '@/lib/worksuite/crm-types';
import {
  downloadCsv,
  downloadXlsx,
  dateStamp,
  type ExportRow,
} from '@/lib/crm-list-export';

const PAGE_SIZE = 25;

const DOC_TYPES: WsClientDocumentType[] = [
  'contract',
  'invoice',
  'proposal',
  'kyc',
  'other',
];

type Row = WsClientDocument & {
  _id: string;
  archived?: boolean;
};

function formatBytes(bytes: unknown): string {
  const b = Number(bytes);
  if (!b) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export default function ClientDocumentsPage() {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [kpis, setKpis] = React.useState<ClientDocumentKpis | null>(null);
  const [clientLabels, setClientLabels] = React.useState<
    Record<string, string>
  >({});

  const [isLoading, startLoad] = React.useTransition();
  const [isMutating, startMutate] = React.useTransition();

  // form state
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [filename, setFilename] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [size, setSize] = React.useState('');
  const [uploadedAt, setUploadedAt] = React.useState('');
  const [docType, setDocType] = React.useState<WsClientDocumentType>('other');
  const [clientId, setClientId] = React.useState('');

  // confirm state
  const [confirmState, setConfirmState] = React.useState<
    | { kind: 'delete'; id: string; label: string }
    | { kind: 'bulkDelete' }
    | { kind: 'bulkArchive' }
    | null
  >(null);

  // filters
  const [q, setQ] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<
    'all' | WsClientDocumentType
  >('all');
  const [clientFilter, setClientFilter] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [page, setPage] = React.useState(1);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const loadAll = React.useCallback(() => {
    startLoad(async () => {
      const [list, k] = await Promise.all([
        getClientDocuments(),
        getClientDocumentKpis(),
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
          r.filename,
          r.url,
          clientLabels[String(r.client_id)] ?? '',
        ]
          .map((x) => String(x ?? '').toLowerCase())
          .join(' ');
        if (!blob.includes(needle)) return false;
      }
      if (typeFilter !== 'all' && (r.doc_type ?? 'other') !== typeFilter)
        return false;
      if (clientFilter && String(r.client_id) !== clientFilter) return false;
      if (fromTs || toTs) {
        const raw = r.uploaded_at ?? r.createdAt;
        const t = new Date(String(raw ?? 0)).getTime();
        if (fromTs && t < fromTs) return false;
        if (toTs && t > toTs) return false;
      }
      return true;
    });
  }, [rows, q, typeFilter, clientFilter, from, to, clientLabels]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = React.useMemo(
    () => filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE),
    [filtered, pageSafe],
  );

  React.useEffect(() => {
    setPage(1);
  }, [q, typeFilter, clientFilter, from, to]);

  const openNew = () => {
    setEditing(null);
    setFilename('');
    setUrl('');
    setSize('');
    setUploadedAt(new Date().toISOString().slice(0, 10));
    setDocType('other');
    setClientId('');
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setFilename(r.filename);
    setUrl(r.url ?? '');
    setSize(r.size != null ? String(r.size) : '');
    setUploadedAt(
      r.uploaded_at ? String(r.uploaded_at).slice(0, 10) : '',
    );
    setDocType((r.doc_type as WsClientDocumentType) ?? 'other');
    setClientId(String(r.client_id));
    setOpen(true);
  };

  const handleSave = () => {
    if (!filename.trim() || !clientId) return;
    const fd = new FormData();
    if (editing) fd.append('_id', editing._id);
    fd.append('client_id', clientId);
    fd.append('filename', filename.trim());
    fd.append('url', url);
    if (size) fd.append('size', size);
    if (uploadedAt) fd.append('uploaded_at', uploadedAt);
    fd.append('doc_type', docType);
    startMutate(async () => {
      const r = await saveClientDocument(undefined, fd);
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
      const r = await deleteClientDocument(id);
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
      const r = await bulkDeleteClientDocuments(ids);
      toast({
        title: r.success ? 'Deleted' : 'Error',
        description: r.success
          ? `${r.deleted} document(s) removed`
          : r.error,
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
      const r = await bulkArchiveClientDocuments(ids);
      toast({
        title: r.success ? 'Archived' : 'Error',
        description: r.success
          ? `${r.archived} document(s) archived`
          : r.error,
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
    const headers = [
      'Filename',
      'Type',
      'Client',
      'Size',
      'Uploaded At',
      'URL',
    ];
    const out: ExportRow[] = filtered.map((r) => ({
      Filename: r.filename,
      Type: r.doc_type ?? 'other',
      Client: clientLabels[String(r.client_id)] ?? String(r.client_id),
      Size: formatBytes(r.size),
      'Uploaded At': r.uploaded_at
        ? String(r.uploaded_at).slice(0, 10)
        : '',
      URL: r.url ?? '',
    }));
    return { headers, rows: out };
  };
  const onExportCsv = () => {
    const { headers, rows: out } = buildExport();
    downloadCsv(`client-documents-${dateStamp()}.csv`, headers, out);
  };
  const onExportXlsx = () => {
    const { headers, rows: out } = buildExport();
    void downloadXlsx(
      `client-documents-${dateStamp()}.xlsx`,
      headers,
      out,
      'Documents',
    );
  };

  const byType = kpis?.byType ?? {};
  const topTypeBreakdown = (['contract', 'invoice', 'proposal'] as const)
    .map((t) => `${t}: ${byType[t] ?? 0}`)
    .join(' · ');

  return (
    <EntityListShell
      title="Client Documents"
      subtitle="Uploaded files (contracts, proposals, KYC) per client account."
      search={{
        value: q,
        onChange: setQ,
        placeholder: 'Search documents…',
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
            Add Document
          </ZoruButton>
        </div>
      }
      filters={
        <>
          <div className="w-40">
            <ZoruSelect
              value={typeFilter}
              onValueChange={(v) =>
                setTypeFilter(v as typeof typeFilter)
              }
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Type" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All types</ZoruSelectItem>
                {DOC_TYPES.map((t) => (
                  <ZoruSelectItem key={t} value={t}>
                    {t}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="w-56">
            <ZoruSelect
              value={clientFilter || 'all'}
              onValueChange={(v) =>
                setClientFilter(v === 'all' ? '' : v)
              }
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Client" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All clients</ZoruSelectItem>
                {clientOptions.map((c) => (
                  <ZoruSelectItem key={c.id} value={c.id}>
                    {c.label}
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
            icon={<Files className="h-4 w-4" />}
            label="Total documents"
            value={(kpis?.total ?? 0).toLocaleString('en-IN')}
            hint="Across all clients"
          />
          <KpiCard
            icon={<FileText className="h-4 w-4" />}
            label="By type"
            value={String(
              (byType.contract ?? 0) +
                (byType.invoice ?? 0) +
                (byType.proposal ?? 0),
            )}
            hint={topTypeBreakdown}
          />
          <KpiCard
            icon={<Upload className="h-4 w-4" />}
            label="Recently uploaded"
            value={(kpis?.recent7d ?? 0).toLocaleString('en-IN')}
            hint="Last 7 days"
          />
          <KpiCard
            icon={<HardDrive className="h-4 w-4" />}
            label="Total size"
            value={formatBytes(kpis?.totalSizeBytes ?? 0)}
            hint="Sum across all uploads"
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
                ? 'No documents yet. Add one above.'
                : 'No documents match the current filters.'}
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
                      Filename
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Client
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Type
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Size
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Uploaded
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Link
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-zoru-ink-muted">
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
                            aria-label={`Select ${r.filename}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <EntityRowLink
                            href={`/dashboard/crm/sales/clients/documents#${r._id}`}
                            label={r.filename}
                            subtitle={r.doc_type ?? 'other'}
                          />
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
                        <td className="px-4 py-3">
                          <ZoruBadge variant="secondary">
                            {r.doc_type ?? 'other'}
                          </ZoruBadge>
                        </td>
                        <td className="px-4 py-3 text-zoru-ink">
                          {formatBytes(r.size)}
                        </td>
                        <td className="px-4 py-3 text-zoru-ink-muted">
                          {formatDate(r.uploaded_at ?? r.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          {r.url ? (
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-accent-foreground underline"
                            >
                              <ExternalLink
                                className="h-3 w-3"
                                strokeWidth={1.75}
                              />
                              Open
                            </a>
                          ) : (
                            '—'
                          )}
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
                                  label: r.filename,
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
                Page {pageSafe} of {totalPages} · {filtered.length} documents
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
                {editing ? 'Edit Document' : 'Add Document'}
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
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <ZoruLabel>Client *</ZoruLabel>
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
              <div className="md:col-span-2">
                <ZoruLabel>Filename *</ZoruLabel>
                <ZoruInput
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className="mt-1.5"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <ZoruLabel>File URL</ZoruLabel>
                <ZoruInput
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="mt-1.5"
                  placeholder="https://…"
                />
              </div>
              <div>
                <ZoruLabel>Type</ZoruLabel>
                <ZoruSelect
                  value={docType}
                  onValueChange={(v) =>
                    setDocType(v as WsClientDocumentType)
                  }
                >
                  <ZoruSelectTrigger className="mt-1.5">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {DOC_TYPES.map((t) => (
                      <ZoruSelectItem key={t} value={t}>
                        {t}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
              <div>
                <ZoruLabel>Size (bytes)</ZoruLabel>
                <ZoruInput
                  type="number"
                  min="0"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <ZoruLabel>Uploaded At</ZoruLabel>
                <ZoruInput
                  type="date"
                  value={uploadedAt}
                  onChange={(e) => setUploadedAt(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 md:col-span-2">
                <ZoruButton
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </ZoruButton>
                <ZoruButton
                  onClick={handleSave}
                  disabled={
                    isMutating || !filename.trim() || !clientId
                  }
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
        title="Delete document?"
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
        title={`Delete ${selected.size} document${
          selected.size === 1 ? '' : 's'
        }?`}
        description="This permanently removes the selected documents."
        requireTyped="DELETE"
        onConfirm={async () => handleBulkDelete()}
      />
      <ConfirmDialog
        open={confirmState?.kind === 'bulkArchive'}
        onOpenChange={(o) => {
          if (!o) setConfirmState(null);
        }}
        title={`Archive ${selected.size} document${
          selected.size === 1 ? '' : 's'
        }?`}
        description="Archived documents remain in the database but hide from the default view."
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
