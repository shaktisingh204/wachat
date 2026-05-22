'use client';

/**
 * Client Contacts — Deep list page.
 *
 * Lists every person attached to a client account with KPIs, filters,
 * bulk operations, and CSV / XLSX export. Each row links via
 * `<EntityRowLink/>` to its parent client.
 *
 * KPIs (`getClientContactKpis`):
 *   - Total contacts
 *   - With email
 *   - Recently added (7d)
 *   - Distinct clients represented
 *
 * Filters: search, primary/secondary type, client_id, date range.
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
  Contact,
  AtSign,
  CalendarPlus,
  Building2,
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
  getClientContacts,
  saveClientContact,
  deleteClientContact,
  bulkDeleteClientContacts,
  bulkArchiveClientContacts,
  getClientContactKpis,
  type ClientContactKpis,
} from '@/app/actions/worksuite/crm-plus.actions';
import { lookupEntity } from '@/app/actions/crm-lookup.actions';
import type { WsClientContact } from '@/lib/worksuite/crm-types';
import {
  downloadCsv,
  downloadXlsx,
  dateStamp,
  type ExportRow,
} from '@/lib/crm-list-export';

const PAGE_SIZE = 25;

type Row = WsClientContact & {
  _id: string;
  archived?: boolean;
};

export default function ClientContactsPage() {
  const { toast } = useZoruToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [kpis, setKpis] = React.useState<ClientContactKpis | null>(null);
  const [clientLabels, setClientLabels] = React.useState<
    Record<string, string>
  >({});

  const [isLoading, startLoad] = React.useTransition();
  const [isMutating, startMutate] = React.useTransition();

  // dialog state
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [name, setName] = React.useState('');
  const [jobTitle, setJobTitle] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [clientId, setClientId] = React.useState('');
  const [isPrimary, setIsPrimary] = React.useState<'yes' | 'no'>('no');

  // confirm dialog
  const [confirmState, setConfirmState] = React.useState<
    | { kind: 'delete'; id: string; label: string }
    | { kind: 'bulkDelete' }
    | { kind: 'bulkArchive' }
    | null
  >(null);

  // filters
  const [q, setQ] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<
    'all' | 'primary' | 'secondary'
  >('all');
  const [clientFilter, setClientFilter] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [page, setPage] = React.useState(1);

  // selection
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const loadAll = React.useCallback(() => {
    startLoad(async () => {
      const [list, k] = await Promise.all([
        getClientContacts(),
        getClientContactKpis(),
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
          r.name,
          r.email,
          r.phone,
          r.job_title,
          clientLabels[String(r.client_id)] ?? '',
        ]
          .map((x) => String(x ?? '').toLowerCase())
          .join(' ');
        if (!blob.includes(needle)) return false;
      }
      const primary =
        r.is_primary === true ||
        (r.is_primary as unknown as string) === 'true' ||
        (r.is_primary as unknown as string) === 'yes';
      if (typeFilter === 'primary' && !primary) return false;
      if (typeFilter === 'secondary' && primary) return false;
      if (clientFilter && String(r.client_id) !== clientFilter) return false;
      if (fromTs || toTs) {
        const t = new Date(String(r.createdAt ?? 0)).getTime();
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
    setName('');
    setJobTitle('');
    setEmail('');
    setPhone('');
    setClientId('');
    setIsPrimary('no');
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setName(r.name);
    setJobTitle(r.job_title ?? '');
    setEmail(r.email ?? '');
    setPhone(r.phone ?? '');
    setClientId(String(r.client_id));
    setIsPrimary(
      r.is_primary === true ||
        (r.is_primary as unknown as string) === 'true' ||
        (r.is_primary as unknown as string) === 'yes'
        ? 'yes'
        : 'no',
    );
    setOpen(true);
  };

  const handleSave = () => {
    if (!name.trim() || !clientId) return;
    const fd = new FormData();
    if (editing) fd.append('_id', editing._id);
    fd.append('client_id', clientId);
    fd.append('name', name.trim());
    fd.append('job_title', jobTitle);
    fd.append('email', email);
    fd.append('phone', phone);
    fd.append('is_primary', isPrimary);
    startMutate(async () => {
      const r = await saveClientContact(undefined, fd);
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
      const r = await deleteClientContact(id);
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
      const r = await bulkDeleteClientContacts(ids);
      toast({
        title: r.success ? 'Deleted' : 'Error',
        description: r.success ? `${r.deleted} contact(s) removed` : r.error,
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
      const r = await bulkArchiveClientContacts(ids);
      toast({
        title: r.success ? 'Archived' : 'Error',
        description: r.success
          ? `${r.archived} contact(s) archived`
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
      'Name',
      'Job Title',
      'Email',
      'Phone',
      'Client',
      'Primary',
      'Created At',
    ];
    const out: ExportRow[] = filtered.map((r) => ({
      Name: r.name,
      'Job Title': r.job_title ?? '',
      Email: r.email ?? '',
      Phone: r.phone ?? '',
      Client: clientLabels[String(r.client_id)] ?? String(r.client_id),
      Primary:
        r.is_primary === true ||
        (r.is_primary as unknown as string) === 'true' ||
        (r.is_primary as unknown as string) === 'yes'
          ? 'Yes'
          : 'No',
      'Created At': r.createdAt ? String(r.createdAt).slice(0, 10) : '',
    }));
    return { headers, rows: out };
  };
  const onExportCsv = () => {
    const { headers, rows: out } = buildExport();
    downloadCsv(`client-contacts-${dateStamp()}.csv`, headers, out);
  };
  const onExportXlsx = () => {
    const { headers, rows: out } = buildExport();
    void downloadXlsx(
      `client-contacts-${dateStamp()}.xlsx`,
      headers,
      out,
      'Contacts',
    );
  };

  return (
    <EntityListShell
      title="Client Contacts"
      subtitle="People associated with your client accounts."
      search={{
        value: q,
        onChange: setQ,
        placeholder: 'Search contacts…',
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
            Add Contact
          </ZoruButton>
        </div>
      }
      filters={
        <>
          <div className="w-40">
            <ZoruSelect
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Type" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All types</ZoruSelectItem>
                <ZoruSelectItem value="primary">Primary only</ZoruSelectItem>
                <ZoruSelectItem value="secondary">
                  Secondary only
                </ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="w-56">
            <ZoruSelect
              value={clientFilter || 'all'}
              onValueChange={(v) => setClientFilter(v === 'all' ? '' : v)}
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
            icon={<Contact className="h-4 w-4" />}
            label="Total contacts"
            value={(kpis?.total ?? 0).toLocaleString('en-IN')}
            hint="Across all client accounts"
          />
          <KpiCard
            icon={<AtSign className="h-4 w-4" />}
            label="With email"
            value={(kpis?.withEmail ?? 0).toLocaleString('en-IN')}
            hint="Reachable via email"
          />
          <KpiCard
            icon={<CalendarPlus className="h-4 w-4" />}
            label="Recently added"
            value={(kpis?.recent7d ?? 0).toLocaleString('en-IN')}
            hint="Created in last 7 days"
          />
          <KpiCard
            icon={<Building2 className="h-4 w-4" />}
            label="Distinct clients"
            value={(kpis?.byClient ?? 0).toLocaleString('en-IN')}
            hint="Client accounts with at least 1 contact"
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
                ? 'No contacts yet. Add one above.'
                : 'No contacts match the current filters.'}
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
                      Name
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Client
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Job Title
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Email
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Phone
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">
                      Primary
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-zoru-ink-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => {
                    const isSel = selected.has(r._id);
                    const primary =
                      r.is_primary === true ||
                      (r.is_primary as unknown as string) === 'true' ||
                      (r.is_primary as unknown as string) === 'yes';
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
                            aria-label={`Select ${r.name}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <EntityRowLink
                            href={`/dashboard/crm/sales/clients/contacts#${r._id}`}
                            label={r.name}
                            subtitle={r.email}
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
                        <td className="px-4 py-3 text-zoru-ink">
                          {r.job_title || '—'}
                        </td>
                        <td className="px-4 py-3 text-zoru-ink">
                          {r.email || '—'}
                        </td>
                        <td className="px-4 py-3 text-zoru-ink">
                          {r.phone || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <ZoruBadge
                            variant={primary ? 'success' : 'secondary'}
                          >
                            {primary ? 'Primary' : 'Secondary'}
                          </ZoruBadge>
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
                                  label: r.name,
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
                Page {pageSafe} of {totalPages} · {filtered.length} contacts
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
                {editing ? 'Edit Contact' : 'Add Contact'}
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
              <div>
                <ZoruLabel>Name *</ZoruLabel>
                <ZoruInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <ZoruLabel>Job Title</ZoruLabel>
                <ZoruInput
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <ZoruLabel>Email</ZoruLabel>
                <ZoruInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <ZoruLabel>Phone</ZoruLabel>
                <ZoruInput
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <ZoruLabel>Primary Contact</ZoruLabel>
                <ZoruSelect
                  value={isPrimary}
                  onValueChange={(v) => setIsPrimary(v as 'yes' | 'no')}
                >
                  <ZoruSelectTrigger className="mt-1.5">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="no">No</ZoruSelectItem>
                    <ZoruSelectItem value="yes">Yes</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
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
                  disabled={isMutating || !name.trim() || !clientId}
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
        title="Delete contact?"
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
        title={`Delete ${selected.size} contact${
          selected.size === 1 ? '' : 's'
        }?`}
        description="This permanently removes the selected contacts."
        requireTyped="DELETE"
        onConfirm={async () => handleBulkDelete()}
      />
      <ConfirmDialog
        open={confirmState?.kind === 'bulkArchive'}
        onOpenChange={(o) => {
          if (!o) setConfirmState(null);
        }}
        title={`Archive ${selected.size} contact${
          selected.size === 1 ? '' : 's'
        }?`}
        description="Archived contacts remain in the database but hide from the default view."
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
