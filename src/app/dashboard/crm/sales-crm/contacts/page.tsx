'use client';

import { ZoruButton, useZoruToast } from '@/components/zoruui';
import {
  useDebouncedCallback } from 'use-debounce';
import { List,
  Plus,
  Sparkles } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { SavedViewsBar } from '@/components/crm/SavedViewsBar';

/**
 * Contacts — list page (rebuilt per §1D.1).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (Total · New leads · Customers · MQL · SQL — clickable)
 *     • Filter row (status · lifecycle · source · owner · account · tag)
 *     • View switcher (Table — default; kanban deferred)
 *     • Bulk action bar when rows are selected
 *     • <ContactsTable />
 *     • Pagination
 *
 * Data flow is client-side. `getCrmContacts` returns `{ contacts, total }`,
 * and KPI counts are derived locally from a single full-tenant fetch
 * (cheap because the dataset is bounded for the typical SMB tenant). When
 * the dataset grows, switch the KPIs to a dedicated `getCrmContactKpis()`
 * server action — same pattern as leads.
 */

import * as React from 'react';
import Link from 'next/link';

import type { SavedView } from '@/lib/saved-views/types';

import {
    deleteCrmContact,
    getCrmContacts,
    updateCrmContact,
} from '@/app/actions/crm.actions';
import type { CrmContact } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import { ContactsTable } from './_components/contacts-table';
import {
    ContactsBulkBar,
    ContactsFiltersRow,
    type ContactLifecycleFilter,
    type ContactStatusFilter,
} from './_components/contacts-filters';
import {
    ContactsKpiStrip,
    EMPTY_KPIS,
    type ContactKpis,
} from './_components/contacts-kpis';

const CONTACTS_PER_PAGE = 20;

type ViewMode = 'table';

export default function CrmContactsPage() {
    const { toast } = useZoruToast();

    /* ─── List state ──────────────────────────────────────────────── */
    const [contacts, setContacts] = React.useState<WithId<CrmContact>[]>([]);
    const [total, setTotal] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const [isPending, startTransition] = React.useTransition();
    const [kpis, setKpis] = React.useState<ContactKpis>(EMPTY_KPIS);

    /* ─── Filters ────────────────────────────────────────────────── */
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] =
        React.useState<ContactStatusFilter>('all');
    const [lifecycleFilter, setLifecycleFilter] =
        React.useState<ContactLifecycleFilter>('all');
    const [sourceFilter, setSourceFilter] = React.useState('');
    const [ownerFilter, setOwnerFilter] = React.useState('');
    const [accountFilter, setAccountFilter] = React.useState('');
    const [tagFilter, setTagFilter] = React.useState('');

    /* ─── Selection + view + dialogs ────────────────────────────── */
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [view] = React.useState<ViewMode>('table');
    const [archiveTargetId, setArchiveTargetId] = React.useState<string | null>(
        null,
    );
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(
        null,
    );

    const hasActiveFilters =
        statusFilter !== 'all' ||
        lifecycleFilter !== 'all' ||
        !!sourceFilter ||
        !!ownerFilter ||
        !!accountFilter ||
        !!tagFilter;

    /* ─── Fetch ────────────────────────────────────────────────── */
    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [rows, kpiRows] = await Promise.all([
                getCrmContacts(
                    page,
                    CONTACTS_PER_PAGE,
                    search || undefined,
                    accountFilter || undefined,
                ),
                // Lightweight KPI fetch: pull the first page large to derive
                // top-level counts client-side. TODO 1D.1: replace with a
                // dedicated `getCrmContactKpis()` action when the tenant
                // dataset grows past 500 contacts.
                getCrmContacts(1, 500, undefined, undefined),
            ]);

            let filtered = rows.contacts;

            // Apply client-side filters that the server action doesn't take.
            if (statusFilter !== 'all') {
                filtered = filtered.filter(
                    (c) => (c.status as string) === statusFilter,
                );
            }
            if (lifecycleFilter !== 'all') {
                filtered = filtered.filter(
                    (c) => c.lifecycleStage === lifecycleFilter,
                );
            }
            if (sourceFilter) {
                filtered = filtered.filter(
                    (c) =>
                        (c.leadSource ?? c.source ?? '') === sourceFilter,
                );
            }
            if (ownerFilter) {
                filtered = filtered.filter(
                    (c) =>
                        c.owner === ownerFilter ||
                        String(c.assignedTo ?? '') === ownerFilter,
                );
            }
            if (tagFilter) {
                filtered = filtered.filter((c) =>
                    Array.isArray(c.tags) ? c.tags.includes(tagFilter) : false,
                );
            }

            setContacts(filtered);
            setTotal(
                hasActiveFilters ? filtered.length : rows.total,
            );

            const all = kpiRows.contacts;
            setKpis({
                total: kpiRows.total,
                newLeads: all.filter((c) => (c.status as string) === 'new_lead')
                    .length,
                customers: all.filter(
                    (c) =>
                        (c.status as string) === 'customer' ||
                        c.lifecycleStage === 'customer',
                ).length,
                mql: all.filter((c) => c.lifecycleStage === 'mql').length,
                sql: all.filter((c) => c.lifecycleStage === 'sql').length,
            });
        });
    }, [
        page,
        search,
        accountFilter,
        statusFilter,
        lifecycleFilter,
        sourceFilter,
        ownerFilter,
        tagFilter,
        hasActiveFilters,
    ]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((next: string) => {
        setSearch(next);
        setPage(1);
    }, 300);

    const clearFilters = React.useCallback(() => {
        setStatusFilter('all');
        setLifecycleFilter('all');
        setSourceFilter('');
        setOwnerFilter('');
        setAccountFilter('');
        setTagFilter('');
        setSearch('');
        setPage(1);
    }, []);

    /* ─── Row actions ────────────────────────────────────────── */
    const handleToggleOne = React.useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleToggleAll = React.useCallback(
        (all: boolean) => {
            setSelected(
                all ? new Set(contacts.map((c) => String(c._id))) : new Set(),
            );
        },
        [contacts],
    );

    const archiveTarget = React.useMemo(
        () =>
            contacts.find((c) => String(c._id) === archiveTargetId) ?? null,
        [contacts, archiveTargetId],
    );
    const deleteTarget = React.useMemo(
        () => contacts.find((c) => String(c._id) === deleteTargetId) ?? null,
        [contacts, deleteTargetId],
    );

    const setStatusFor = React.useCallback(
        async (ids: string[], nextStatus: string) => {
            let ok = 0;
            let fail = 0;
            for (const id of ids) {
                const target = contacts.find((c) => String(c._id) === id);
                if (!target) continue;
                const fd = new FormData();
                fd.set('contactId', id);
                fd.set('name', target.name);
                fd.set('email', target.email);
                fd.set('status', nextStatus);
                const res = await updateCrmContact({}, fd);
                if (res.error) fail++;
                else ok++;
            }
            return { ok, fail };
        },
        [contacts],
    );

    const handleConfirmArchive = React.useCallback(async () => {
        if (!archiveTargetId || !archiveTarget) return;
        const archived =
            (archiveTarget.status as string)?.toLowerCase() === 'archived';
        if (archived) {
            const res = await setStatusFor([archiveTargetId], 'new_lead');
            if (res.ok)
                toast({ title: 'Contact restored' });
            else
                toast({
                    title: 'Restore failed',
                    variant: 'destructive',
                });
        } else {
            const res = await setStatusFor([archiveTargetId], 'archived');
            if (res.ok) toast({ title: 'Contact archived' });
            else
                toast({
                    title: 'Archive failed',
                    variant: 'destructive',
                });
        }
        fetchData();
        setArchiveTargetId(null);
    }, [archiveTarget, archiveTargetId, fetchData, setStatusFor, toast]);

    const handleConfirmDelete = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deleteCrmContact(deleteTargetId);
        if (res.success) {
            toast({ title: 'Contact deleted' });
            fetchData();
        } else {
            toast({
                title: 'Delete failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setDeleteTargetId(null);
    }, [deleteTargetId, fetchData, toast]);

    /* ─── Bulk actions ──────────────────────────────────────── */
    const runBulk = React.useCallback(
        async (
            op: 'archive' | 'delete' | 'status',
            payload?: string,
        ): Promise<void> => {
            if (selected.size === 0) return;
            const ids = Array.from(selected);
            if (op === 'delete') {
                let ok = 0;
                let fail = 0;
                for (const id of ids) {
                    const res = await deleteCrmContact(id);
                    if (res.success) ok++;
                    else fail++;
                }
                toast({
                    title: `${ok} deleted${fail ? `, ${fail} failed` : ''}`,
                    variant: fail ? 'destructive' : 'default',
                });
            } else if (op === 'archive') {
                const res = await setStatusFor(ids, 'archived');
                toast({
                    title: `${res.ok} archived${res.fail ? `, ${res.fail} failed` : ''}`,
                    variant: res.fail ? 'destructive' : 'default',
                });
            } else if (op === 'status' && payload) {
                const res = await setStatusFor(ids, payload);
                toast({
                    title: `${res.ok} updated${res.fail ? `, ${res.fail} failed` : ''}`,
                    variant: res.fail ? 'destructive' : 'default',
                });
            }
            setSelected(new Set());
            fetchData();
        },
        [selected, fetchData, setStatusFor, toast],
    );

    const exportCsv = React.useCallback(() => {
        const rows =
            selected.size > 0
                ? contacts.filter((c) => selected.has(String(c._id)))
                : contacts;
        const header = [
            'Name',
            'Email',
            'Phone',
            'Company',
            'JobTitle',
            'Status',
            'LifecycleStage',
            'LeadSource',
            'Owner',
            'CreatedAt',
        ];
        const escape = (v: unknown) =>
            `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            header.join(','),
            ...rows.map((c) =>
                [
                    escape(c.name),
                    escape(c.email),
                    escape(c.phone),
                    escape(c.company),
                    escape(c.jobTitle),
                    escape(c.status),
                    escape(c.lifecycleStage),
                    escape(c.leadSource ?? c.source ?? ''),
                    escape(c.owner ?? c.assignedTo ?? ''),
                    escape(
                        c.createdAt ? new Date(c.createdAt).toISOString() : '',
                    ),
                ].join(','),
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [contacts, selected]);

    const totalPages = Math.max(1, Math.ceil(total / CONTACTS_PER_PAGE));

    return (
        <>
            <EntityListShell
                title="Contacts"
                subtitle="People in your CRM — buyers, champions and influencers."
                viewSwitcher={
                    <div className="inline-flex rounded-md border border-zoru-line p-0.5">
                        <button
                            type="button"
                            aria-pressed={view === 'table'}
                            className="inline-flex items-center gap-1 rounded-sm bg-zoru-surface px-2 py-1 text-[12px] text-zoru-ink"
                        >
                            <List className="h-3.5 w-3.5" /> Table
                        </button>
                        {/* TODO 1D.1: card-grid + kanban-by-lifecycle views deferred — table is the contract default. */}
                    </div>
                }
                search={{
                    value: search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search name, email, phone, company…',
                }}
                primaryAction={
                    <ZoruButton asChild>
                        <Link href="/dashboard/crm/sales-crm/contacts/new">
                            <Plus className="h-4 w-4" /> New Contact
                        </Link>
                    </ZoruButton>
                }
                filters={
                    <ContactsFiltersRow
                        statusFilter={statusFilter}
                        onStatusChange={(v) => {
                            setStatusFilter(v);
                            setPage(1);
                        }}
                        lifecycleFilter={lifecycleFilter}
                        onLifecycleChange={(v) => {
                            setLifecycleFilter(v);
                            setPage(1);
                        }}
                        sourceFilter={sourceFilter}
                        onSourceChange={(v) => {
                            setSourceFilter(v);
                            setPage(1);
                        }}
                        ownerFilter={ownerFilter}
                        onOwnerChange={(v) => {
                            setOwnerFilter(v);
                            setPage(1);
                        }}
                        accountFilter={accountFilter}
                        onAccountChange={(v) => {
                            setAccountFilter(v);
                            setPage(1);
                        }}
                        tagFilter={tagFilter}
                        onTagChange={(v) => {
                            setTagFilter(v);
                            setPage(1);
                        }}
                        hasActiveFilters={hasActiveFilters}
                        onClear={clearFilters}
                    />
                }
                bulkBar={
                    selected.size > 0 ? (
                        <ContactsBulkBar
                            count={selected.size}
                            onClear={() => setSelected(new Set())}
                            onArchive={() => void runBulk('archive')}
                            onDelete={() => void runBulk('delete')}
                            onStatusChange={(s) => void runBulk('status', s)}
                            onExport={exportCsv}
                        />
                    ) : null
                }
                empty={
                    !isPending && contacts.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <Sparkles className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">
                                No contacts yet
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Add the people who buy from, influence, or
                                champion your accounts. Contacts feed your
                                deals, tickets and email outreach.
                            </p>
                            <ZoruButton asChild>
                                <Link href="/dashboard/crm/sales-crm/contacts/new">
                                    <Plus className="h-4 w-4" /> Add your first
                                    contact
                                </Link>
                            </ZoruButton>
                        </div>
                    ) : null
                }
                loading={isPending && contacts.length === 0}
                pagination={
                    contacts.length > 0 ? (
                        <PaginationBar
                            page={page}
                            limit={CONTACTS_PER_PAGE}
                            hasMore={page < totalPages}
                            total={total}
                            controlled={{
                                onChange: (next) => setPage(next.page),
                            }}
                        />
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    <SavedViewsBar
                        entityKind="contact"
                        currentFilters={{
                            search,
                            statusFilter,
                            lifecycleFilter,
                            sourceFilter,
                            ownerFilter,
                            accountFilter,
                            tagFilter,
                        }}
                        currentColumns={[]}
                        onApplyView={(view: SavedView) => {
                            const f = (view.filters ?? {}) as Record<string, unknown>;
                            if (typeof f.search === 'string') setSearch(f.search);
                            if (typeof f.statusFilter === 'string')
                                setStatusFilter(f.statusFilter as ContactStatusFilter);
                            if (typeof f.lifecycleFilter === 'string')
                                setLifecycleFilter(f.lifecycleFilter as ContactLifecycleFilter);
                            if (typeof f.sourceFilter === 'string')
                                setSourceFilter(f.sourceFilter);
                            if (typeof f.ownerFilter === 'string')
                                setOwnerFilter(f.ownerFilter);
                            if (typeof f.accountFilter === 'string')
                                setAccountFilter(f.accountFilter);
                            if (typeof f.tagFilter === 'string')
                                setTagFilter(f.tagFilter);
                            setPage(1);
                        }}
                    />
                    <ContactsKpiStrip
                        kpis={kpis}
                        statusFilter={statusFilter}
                        lifecycleFilter={lifecycleFilter}
                        hasActiveFilters={hasActiveFilters}
                        onClearAll={clearFilters}
                        onSetStatus={(next) => {
                            setStatusFilter(next);
                            setPage(1);
                        }}
                        onSetLifecycle={(next) => {
                            setLifecycleFilter(next);
                            setPage(1);
                        }}
                    />

                    <ContactsTable
                        contacts={contacts}
                        loading={isPending}
                        selectedIds={selected}
                        onToggleOne={handleToggleOne}
                        onToggleAll={handleToggleAll}
                        onArchive={(id) => setArchiveTargetId(id)}
                        onDelete={(id) => setDeleteTargetId(id)}
                    />
                </div>
            </EntityListShell>

            {/* Archive confirmation */}
            <ConfirmDialog
                open={!!archiveTargetId}
                onOpenChange={(o) => !o && setArchiveTargetId(null)}
                title={
                    (archiveTarget?.status as string)?.toLowerCase() ===
                    'archived'
                        ? 'Restore this contact?'
                        : 'Archive this contact?'
                }
                description={
                    (archiveTarget?.status as string)?.toLowerCase() ===
                    'archived'
                        ? `"${archiveTarget?.name}" will be restored to your active list.`
                        : `"${archiveTarget?.name}" will be hidden from default views. You can restore it later.`
                }
                confirmLabel={
                    (archiveTarget?.status as string)?.toLowerCase() ===
                    'archived'
                        ? 'Restore'
                        : 'Archive'
                }
                confirmTone="primary"
                onConfirm={handleConfirmArchive}
            />

            {/* Delete (hard) confirmation — uncommon but available */}
            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this contact permanently?"
                description={`This permanently removes "${deleteTarget?.name}". This action cannot be undone.`}
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />
        </>
    );
}
