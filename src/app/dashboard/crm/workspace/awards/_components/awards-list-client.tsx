'use client';

/**
 * AwardsListClient — full-feature list (§1D.1 bar).
 *
 * Features:
 *  - KPI strip: total programs · this month nominations · unique recipients ·
 *               award types
 *  - Tab switcher: Programs | Appreciations (given awards)
 *  - Programs table: Program name · Icon · Frequency · Nominations · Actions
 *  - Appreciations table: Award name · Recipient · Given by · Date · Message ·
 *                         Actions (delete)
 *  - Filters: search · frequency (programs tab) / award (appreciations tab) ·
 *             date range (appreciations tab)
 *  - Bulk delete
 *  - Export CSV
 */

import * as React from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import {
    Award as AwardIcon,
    Heart,
    Plus,
    Trash2,
    Trophy,
    Users,
    X,
} from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCheckbox,
    ZoruInput,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruStatCard,
    useZoruToast,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill } from '@/components/crm/status-pill';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import {
    deleteAward,
    deleteAppreciation,
    getAwards,
    getAppreciations,
} from '@/app/actions/worksuite/knowledge.actions';
import type { WsAward, WsAppreciation, WsAwardFrequency } from '@/lib/worksuite/knowledge-types';
import type { AwardKpis } from '@/app/actions/worksuite/knowledge.actions';

type Tab = 'programs' | 'appreciations';
type FrequencyFilter = 'all' | WsAwardFrequency;

interface AwardsListClientProps {
    initialAwards: (WsAward & { _id: string })[];
    initialAppreciations: (WsAppreciation & { _id: string })[];
    initialKpis: AwardKpis;
}

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function AwardsListClient({
    initialAwards,
    initialAppreciations,
    initialKpis,
}: AwardsListClientProps): React.JSX.Element {
    const { toast } = useZoruToast();

    const [awards, setAwards] = React.useState<(WsAward & { _id: string })[]>(initialAwards);
    const [apps, setApps] = React.useState<(WsAppreciation & { _id: string })[]>(
        initialAppreciations,
    );
    const [kpis] = React.useState<AwardKpis>(initialKpis);
    const [loading, startTransition] = React.useTransition();

    const [tab, setTab] = React.useState<Tab>('programs');
    const [searchDraft, setSearchDraft] = React.useState('');
    const [search, setSearch] = React.useState('');
    const [frequency, setFrequency] = React.useState<FrequencyFilter>('all');
    const [awardFilter, setAwardFilter] = React.useState<string>('all');
    const [fromIso, setFromIso] = React.useState('');
    const [toIso, setToIso] = React.useState('');

    const [selectedPrograms, setSelectedPrograms] = React.useState<Set<string>>(new Set());
    const [selectedApps, setSelectedApps] = React.useState<Set<string>>(new Set());
    const [deleteId, setDeleteId] = React.useState<string | null>(null);
    const [deleteMode, setDeleteMode] = React.useState<Tab>('programs');
    const [bulkDeleteMode, setBulkDeleteMode] = React.useState<Tab | null>(null);

    const handleSearch = useDebouncedCallback(
        (v: string) => setSearch(v),
        200,
    );

    const refetch = React.useCallback(() => {
        startTransition(async () => {
            try {
                const [aw, ap] = await Promise.all([getAwards(), getAppreciations()]);
                setAwards(aw as (WsAward & { _id: string })[]);
                setApps(ap as (WsAppreciation & { _id: string })[]);
            } catch (err) {
                toast({
                    title: 'Could not reload awards',
                    description: err instanceof Error ? err.message : 'Unknown',
                    variant: 'destructive',
                });
            }
        });
    }, [toast]);

    const from = fromIso ? new Date(fromIso).getTime() : null;
    const to = toIso ? new Date(toIso).getTime() : null;

    const visiblePrograms = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return awards.filter((a) => {
            if (q) {
                const hay = `${a.title ?? ''} ${a.summary ?? ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (frequency !== 'all' && a.frequency !== frequency) return false;
            return true;
        });
    }, [awards, search, frequency]);

    const visibleApps = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return apps.filter((a) => {
            if (q) {
                const hay =
                    `${a.award_title ?? ''} ${a.given_to_user_name ?? ''} ${a.given_by_user_name ?? ''} ${a.summary ?? ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (awardFilter !== 'all' && a.award_id !== awardFilter) return false;
            if (from !== null || to !== null) {
                const ms = new Date(a.given_on as string).getTime();
                if (from !== null && ms < from) return false;
                if (to !== null && ms > to) return false;
            }
            return true;
        });
    }, [apps, search, awardFilter, from, to]);

    const hasActiveFilters =
        search !== '' ||
        frequency !== 'all' ||
        awardFilter !== 'all' ||
        fromIso !== '' ||
        toIso !== '';

    const clearFilters = () => {
        setSearch('');
        setSearchDraft('');
        setFrequency('all');
        setAwardFilter('all');
        setFromIso('');
        setToIso('');
    };

    // ── Single delete ──
    const handleConfirmDelete = React.useCallback(async () => {
        if (!deleteId) return;
        const r =
            deleteMode === 'programs'
                ? await deleteAward(deleteId)
                : await deleteAppreciation(deleteId);
        if (r.success) {
            toast({ title: deleteMode === 'programs' ? 'Award deleted' : 'Appreciation deleted' });
            refetch();
        } else {
            toast({ title: 'Delete failed', description: r.error, variant: 'destructive' });
        }
        setDeleteId(null);
    }, [deleteId, deleteMode, refetch, toast]);

    // ── Bulk delete ──
    const runBulkDelete = React.useCallback(async () => {
        const ids = Array.from(
            bulkDeleteMode === 'programs' ? selectedPrograms : selectedApps,
        );
        if (ids.length === 0) return;
        let ok = 0;
        let fail = 0;
        for (const id of ids) {
            const r =
                bulkDeleteMode === 'programs'
                    ? await deleteAward(id)
                    : await deleteAppreciation(id);
            if (r.success) ok += 1;
            else fail += 1;
        }
        toast({
            title: 'Bulk delete',
            description: `${ok} deleted${fail ? `, ${fail} failed` : ''}`,
            variant: fail > 0 ? 'destructive' : undefined,
        });
        if (bulkDeleteMode === 'programs') setSelectedPrograms(new Set());
        else setSelectedApps(new Set());
        setBulkDeleteMode(null);
        refetch();
    }, [bulkDeleteMode, selectedPrograms, selectedApps, refetch, toast]);

    // ── Export ──
    const exportCsv = React.useCallback(() => {
        if (tab === 'programs') {
            const rows = (
                selectedPrograms.size > 0
                    ? visiblePrograms.filter((a) => selectedPrograms.has(a._id))
                    : visiblePrograms
            ).map((a) => ({
                ID: a._id,
                Title: a.title,
                Icon: a.icon,
                Frequency: a.frequency,
                Nominations: apps.filter((x) => x.award_id === a._id).length,
            }));
            downloadCsv(
                `award-programs-${dateStamp()}.csv`,
                ['ID', 'Title', 'Icon', 'Frequency', 'Nominations'],
                rows,
            );
        } else {
            const rows = (
                selectedApps.size > 0
                    ? visibleApps.filter((a) => selectedApps.has(a._id))
                    : visibleApps
            ).map((a) => ({
                ID: a._id,
                'Award name': a.award_title ?? awards.find((aw) => aw._id === a.award_id)?.title ?? a.award_id,
                Recipient: a.given_to_user_name ?? a.given_to_user_id,
                'Given by': a.given_by_user_name ?? a.given_by_user_id,
                Date: fmtDate(a.given_on),
                Message: (a.summary ?? '').replace(/\n/g, ' '),
            }));
            downloadCsv(
                `appreciations-${dateStamp()}.csv`,
                ['ID', 'Award name', 'Recipient', 'Given by', 'Date', 'Message'],
                rows,
            );
        }
    }, [tab, visiblePrograms, visibleApps, selectedPrograms, selectedApps, apps, awards]);

    const selectedSet = tab === 'programs' ? selectedPrograms : selectedApps;
    const setSelected = tab === 'programs' ? setSelectedPrograms : setSelectedApps;
    const visibleList = tab === 'programs' ? visiblePrograms : visibleApps;

    const allSelected =
        visibleList.length > 0 && visibleList.every((a) => selectedSet.has(a._id));

    const toggleOne = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const toggleAll = (on: boolean) =>
        setSelected(on ? new Set(visibleList.map((a) => a._id)) : new Set());

    return (
        <>
            <EntityListShell
                title="Awards"
                subtitle="Recognition programs and appreciations for your team."
                search={{
                    value: searchDraft,
                    onChange: (v) => {
                        setSearchDraft(v);
                        handleSearch(v);
                    },
                    placeholder:
                        tab === 'programs'
                            ? 'Search award programs…'
                            : 'Search recipient, giver, or message…',
                }}
                primaryAction={
                    <div className="flex gap-2">
                        <ZoruButton asChild variant="outline">
                            <Link href="/dashboard/crm/workspace/awards/appreciations">
                                <Heart className="h-4 w-4" /> Appreciations
                            </Link>
                        </ZoruButton>
                        <ZoruButton asChild>
                            <Link href="/dashboard/crm/workspace/awards/new">
                                <Plus className="h-4 w-4" /> New award
                            </Link>
                        </ZoruButton>
                    </div>
                }
                viewSwitcher={
                    <div className="inline-flex rounded-md border border-zoru-line p-0.5">
                        {(['programs', 'appreciations'] as Tab[]).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTab(t)}
                                aria-pressed={tab === t}
                                className={[
                                    'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px] capitalize',
                                    tab === t
                                        ? 'bg-zoru-surface text-zoru-ink'
                                        : 'text-zoru-ink-muted hover:text-zoru-ink',
                                ].join(' ')}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                }
                filters={
                    <div className="flex flex-wrap items-center gap-2">
                        {tab === 'programs' ? (
                            <ZoruSelect
                                value={frequency}
                                onValueChange={(v) => setFrequency(v as FrequencyFilter)}
                            >
                                <ZoruSelectTrigger className="h-9 w-[160px]">
                                    <ZoruSelectValue placeholder="Frequency" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="all">Any frequency</ZoruSelectItem>
                                    <ZoruSelectItem value="one-time">One-time</ZoruSelectItem>
                                    <ZoruSelectItem value="monthly">Monthly</ZoruSelectItem>
                                    <ZoruSelectItem value="quarterly">Quarterly</ZoruSelectItem>
                                    <ZoruSelectItem value="annual">Annual</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        ) : (
                            <>
                                <ZoruSelect
                                    value={awardFilter}
                                    onValueChange={(v) => setAwardFilter(v)}
                                >
                                    <ZoruSelectTrigger className="h-9 w-[180px]">
                                        <ZoruSelectValue placeholder="Award program" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="all">Any program</ZoruSelectItem>
                                        {awards.map((a) => (
                                            <ZoruSelectItem key={a._id} value={a._id}>
                                                {a.title}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                                <ZoruInput
                                    type="date"
                                    value={fromIso}
                                    onChange={(e) => setFromIso(e.target.value)}
                                    className="h-9 w-[150px]"
                                    aria-label="Given from"
                                />
                                <ZoruInput
                                    type="date"
                                    value={toIso}
                                    onChange={(e) => setToIso(e.target.value)}
                                    className="h-9 w-[150px]"
                                    aria-label="Given to"
                                />
                            </>
                        )}
                        {hasActiveFilters ? (
                            <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
                                <X className="h-3.5 w-3.5" /> Clear
                            </ZoruButton>
                        ) : null}
                        <ZoruButton variant="ghost" size="sm" onClick={exportCsv}>
                            Export CSV
                        </ZoruButton>
                    </div>
                }
                bulkBar={
                    selectedSet.size > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[13px] text-zoru-ink-muted">
                                {selectedSet.size} selected
                            </span>
                            <div className="flex flex-wrap gap-2">
                                <ZoruButton variant="ghost" size="sm" onClick={exportCsv}>
                                    Export CSV
                                </ZoruButton>
                                <ZoruButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setBulkDeleteMode(tab)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                </ZoruButton>
                                <ZoruButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelected(new Set())}
                                >
                                    Clear
                                </ZoruButton>
                            </div>
                        </div>
                    ) : null
                }
                empty={
                    !loading && visibleList.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <AwardIcon className="h-6 w-6 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">
                                {tab === 'programs'
                                    ? 'No award programs yet'
                                    : 'No appreciations yet'}
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                {tab === 'programs'
                                    ? 'Define a recognition program and grant appreciations against it.'
                                    : 'Give your first appreciation from the Appreciations page.'}
                            </p>
                            <ZoruButton asChild>
                                <Link href="/dashboard/crm/workspace/awards/new">
                                    <Plus className="h-4 w-4" /> Create award
                                </Link>
                            </ZoruButton>
                        </div>
                    ) : null
                }
                loading={loading && awards.length === 0}
            >
                <div className="flex flex-col gap-4">
                    {/* KPI strip */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <ZoruStatCard
                            label="Active programs"
                            value={kpis.totalPrograms}
                            icon={<AwardIcon className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="Nominations this month"
                            value={kpis.thisMonth}
                            icon={<Heart className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="Unique recipients"
                            value={kpis.uniqueRecipients}
                            icon={<Trophy className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="Award types"
                            value={kpis.awardTypes}
                            icon={<Users className="h-4 w-4" />}
                        />
                    </div>

                    {/* Programs table */}
                    {tab === 'programs' ? (
                        <div className="overflow-x-auto rounded-[var(--zoru-radius-lg)] border border-zoru-line">
                            <table className="w-full min-w-[700px] text-[13px]">
                                <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                                    <tr>
                                        <th className="px-3 py-2">
                                            <ZoruCheckbox
                                                aria-label="Select all"
                                                checked={allSelected}
                                                onCheckedChange={(v) => toggleAll(!!v)}
                                            />
                                        </th>
                                        {['Program', 'Icon', 'Frequency', 'Nominations', 'Status', ''].map(
                                            (h) => (
                                                <th
                                                    key={h}
                                                    className="px-3 py-2 text-left font-medium"
                                                >
                                                    {h}
                                                </th>
                                            ),
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zoru-line bg-zoru-bg">
                                    {visiblePrograms.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="p-6 text-center text-zoru-ink-muted"
                                            >
                                                No awards match the current filters.
                                            </td>
                                        </tr>
                                    ) : null}
                                    {visiblePrograms.map((a) => {
                                        const nominations = apps.filter(
                                            (x) => x.award_id === a._id,
                                        ).length;
                                        const checked = selectedPrograms.has(a._id);
                                        return (
                                            <tr key={a._id} className="hover:bg-zoru-surface">
                                                <td className="px-3 py-2">
                                                    <ZoruCheckbox
                                                        aria-label={`Select ${a.title}`}
                                                        checked={checked}
                                                        onCheckedChange={() => toggleOne(a._id)}
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <EntityRowLink
                                                        href={`/dashboard/crm/workspace/awards/${a._id}`}
                                                        label={a.title}
                                                        subtitle={a.summary || undefined}
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-[18px]">
                                                    {a.icon || ''}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <ZoruBadge
                                                        variant="warning"
                                                        className="capitalize"
                                                    >
                                                        {a.frequency}
                                                    </ZoruBadge>
                                                </td>
                                                <td className="px-3 py-2 text-zoru-ink-muted">
                                                    {nominations}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <StatusPill label="Active" tone="green" />
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setDeleteMode('programs');
                                                            setDeleteId(a._id);
                                                        }}
                                                        aria-label={`Delete ${a.title}`}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </ZoruButton>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* Appreciations table */
                        <div className="overflow-x-auto rounded-[var(--zoru-radius-lg)] border border-zoru-line">
                            <table className="w-full min-w-[800px] text-[13px]">
                                <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                                    <tr>
                                        <th className="px-3 py-2">
                                            <ZoruCheckbox
                                                aria-label="Select all"
                                                checked={allSelected}
                                                onCheckedChange={(v) => toggleAll(!!v)}
                                            />
                                        </th>
                                        {[
                                            'Award name',
                                            'Recipient',
                                            'Given by',
                                            'Date',
                                            'Message',
                                            '',
                                        ].map((h) => (
                                            <th
                                                key={h}
                                                className="px-3 py-2 text-left font-medium"
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zoru-line bg-zoru-bg">
                                    {visibleApps.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="p-6 text-center text-zoru-ink-muted"
                                            >
                                                No appreciations match the current filters.
                                            </td>
                                        </tr>
                                    ) : null}
                                    {visibleApps.map((a) => {
                                        const awardTitle =
                                            a.award_title ??
                                            awards.find((aw) => aw._id === a.award_id)?.title ??
                                            a.award_id;
                                        const checked = selectedApps.has(a._id);
                                        return (
                                            <tr key={a._id} className="hover:bg-zoru-surface">
                                                <td className="px-3 py-2">
                                                    <ZoruCheckbox
                                                        aria-label={`Select appreciation ${a._id}`}
                                                        checked={checked}
                                                        onCheckedChange={() => toggleOne(a._id)}
                                                    />
                                                </td>
                                                <td className="px-3 py-2 font-medium text-zoru-ink">
                                                    {awardTitle}
                                                </td>
                                                <td className="px-3 py-2 text-zoru-ink-muted">
                                                    {a.given_to_user_name ?? a.given_to_user_id}
                                                </td>
                                                <td className="px-3 py-2 text-zoru-ink-muted">
                                                    {a.given_by_user_name ?? a.given_by_user_id}
                                                </td>
                                                <td className="px-3 py-2 text-zoru-ink-muted">
                                                    {fmtDate(a.given_on)}
                                                </td>
                                                <td className="max-w-[200px] truncate px-3 py-2 text-zoru-ink-muted">
                                                    {a.summary
                                                        ? a.summary.length > 60
                                                            ? `${a.summary.slice(0, 60)}…`
                                                            : a.summary
                                                        : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setDeleteMode('appreciations');
                                                            setDeleteId(a._id);
                                                        }}
                                                        aria-label="Delete appreciation"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </ZoruButton>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </EntityListShell>

            {/* Single delete */}
            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={(o) => !o && setDeleteId(null)}
                title={
                    deleteMode === 'programs'
                        ? 'Delete this award program?'
                        : 'Delete this appreciation?'
                }
                description={
                    deleteMode === 'programs'
                        ? 'The program will be permanently removed. Existing appreciations are kept but lose their program reference.'
                        : 'The appreciation will be permanently removed.'
                }
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />

            {/* Bulk delete */}
            <ConfirmDialog
                open={!!bulkDeleteMode}
                onOpenChange={(o) => !o && setBulkDeleteMode(null)}
                title={`Delete ${selectedSet.size} item(s)?`}
                description="The selected items will be permanently removed."
                requireTyped="DELETE"
                confirmLabel="Delete"
                confirmTone="danger"
                onConfirm={() => {
                    void runBulkDelete();
                }}
            />
        </>
    );
}

export default AwardsListClient;
