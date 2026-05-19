'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruInput,
  ZoruStatCard,
  useZoruToast,
} from '@/components/zoruui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  useDebouncedCallback } from 'use-debounce';
import {
    Award as AwardIcon,
  Heart,
  Plus,
  Trash2,
  Trophy,
  Users,
  X,
  } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill } from '@/components/crm/status-pill';

/**
 * Awards list (§1D.1) — KPI strip (4) · filter chips · table.
 *
 * The "program" entity here maps to `WsAward` (a recurring program with a
 * frequency). Nomination volume / winners / points are derived from the
 * companion `appreciations` collection.
 */

import * as React from 'react';
import Link from 'next/link';

import {
    deleteAward,
    getAppreciations,
    getAwards,
} from '@/app/actions/worksuite/knowledge.actions';
import type { WsAppreciation, WsAward, WsAwardFrequency } from '@/lib/worksuite/knowledge-types';

type FrequencyFilter = 'all' | WsAwardFrequency;

interface FilterState {
    search: string;
    frequency: FrequencyFilter;
}

const INITIAL: FilterState = { search: '', frequency: 'all' };

function isThisMonth(d: Date): boolean {
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function AwardsListClient(): React.JSX.Element {
    const { toast } = useZoruToast();
    const [awards, setAwards] = React.useState<(WsAward & { _id: string })[]>([]);
    const [apps, setApps] = React.useState<(WsAppreciation & { _id: string })[]>([]);
    const [loading, startTransition] = React.useTransition();
    const [filters, setFilters] = React.useState<FilterState>(INITIAL);
    const [deleteId, setDeleteId] = React.useState<string | null>(null);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            try {
                const [aw, ap] = await Promise.all([getAwards(), getAppreciations()]);
                setAwards(aw as (WsAward & { _id: string })[]);
                setApps(ap as (WsAppreciation & { _id: string })[]);
            } catch (err) {
                toast({
                    title: 'Could not load awards',
                    description: err instanceof Error ? err.message : 'Unknown',
                    variant: 'destructive',
                });
            }
        });
    }, [toast]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback(
        (v: string) => setFilters((p) => ({ ...p, search: v })),
        200,
    );

    const visible = React.useMemo(() => {
        const q = filters.search.trim().toLowerCase();
        return awards.filter((a) => {
            if (q) {
                const hay = `${a.title ?? ''} ${a.summary ?? ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (filters.frequency !== 'all' && a.frequency !== filters.frequency) return false;
            return true;
        });
    }, [awards, filters]);

    const kpis = React.useMemo(() => {
        let thisMonth = 0;
        let winners = 0;
        for (const ap of apps) {
            const d = new Date(ap.given_on as string);
            if (Number.isFinite(d.getTime()) && isThisMonth(d)) thisMonth += 1;
        }
        // Winners = unique recipients across appreciations.
        const winnerSet = new Set(apps.map((a) => a.given_to_user_id));
        winners = winnerSet.size;
        return {
            programs: awards.length,
            thisMonth,
            winners,
            totalAppreciations: apps.length,
        };
    }, [awards, apps]);

    const handleDelete = React.useCallback(async () => {
        if (!deleteId) return;
        const r = await deleteAward(deleteId);
        if (r.success) {
            toast({ title: 'Award deleted' });
            fetchData();
        } else {
            toast({ title: 'Delete failed', description: r.error, variant: 'destructive' });
        }
        setDeleteId(null);
    }, [deleteId, fetchData, toast]);

    const exportCsv = React.useCallback(() => {
        const header = ['ID', 'Title', 'Icon', 'Frequency', 'Nominations'];
        const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            header.join(','),
            ...visible.map((a) => {
                const noms = apps.filter((x) => x.award_id === a._id).length;
                return [
                    esc(a._id),
                    esc(a.title),
                    esc(a.icon),
                    esc(a.frequency),
                    esc(noms),
                ].join(',');
            }),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const aEl = document.createElement('a');
        aEl.href = url;
        aEl.download = `awards-${new Date().toISOString().slice(0, 10)}.csv`;
        aEl.click();
        URL.revokeObjectURL(url);
    }, [visible, apps]);

    return (
        <>
            <EntityListShell
                title="Awards"
                subtitle="Recognition programs and appreciations for your team."
                search={{
                    value: filters.search,
                    onChange: (v) => handleSearch(v),
                    placeholder: 'Search award programs…',
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
                filters={
                    <div className="flex flex-wrap items-center gap-2">
                        <EnumFilterField
                            enumName="awardFrequency"
                            value={filters.frequency}
                            onChange={(v) =>
                                setFilters((p) => ({ ...p, frequency: v as FrequencyFilter }))
                            }
                            allLabel="Any frequency"
                        />
                        {filters.frequency !== 'all' || filters.search !== '' ? (
                            <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() => setFilters(INITIAL)}
                            >
                                <X className="h-3.5 w-3.5" /> Clear
                            </ZoruButton>
                        ) : null}
                        <ZoruButton variant="ghost" size="sm" onClick={exportCsv}>
                            Export CSV
                        </ZoruButton>
                    </div>
                }
                empty={
                    !loading && awards.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <AwardIcon className="h-6 w-6 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">
                                No award programs yet
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                Define a recognition program — “Star of the month”, “Top sales”,
                                anything — and grant appreciations against it.
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
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <ZoruStatCard
                            label="Active programs"
                            value={kpis.programs}
                            icon={<AwardIcon className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="Nominations this month"
                            value={kpis.thisMonth}
                            icon={<Heart className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="Winners"
                            value={kpis.winners}
                            icon={<Trophy className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="Total appreciations"
                            value={kpis.totalAppreciations}
                            icon={<Users className="h-4 w-4" />}
                        />
                    </div>

                    <div className="overflow-x-auto rounded-[var(--zoru-radius-lg)] border border-zoru-line">
                        <table className="w-full min-w-[700px] text-[13px]">
                            <thead className="bg-zoru-surface-2 text-zoru-ink-muted">
                                <tr>
                                    {[
                                        'Program',
                                        'Icon',
                                        'Frequency',
                                        'Nominations',
                                        'Status',
                                        '',
                                    ].map((h) => (
                                        <th key={h} className="px-3 py-2 text-left font-medium">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zoru-line bg-zoru-bg">
                                {visible.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-6 text-center text-zoru-ink-muted">
                                            No awards match the current filters.
                                        </td>
                                    </tr>
                                ) : null}
                                {visible.map((a) => {
                                    const nominations = apps.filter(
                                        (x) => x.award_id === a._id,
                                    ).length;
                                    return (
                                        <tr key={a._id} className="hover:bg-zoru-surface">
                                            <td className="px-3 py-2">
                                                <EntityRowLink
                                                    href={`/dashboard/crm/workspace/awards/${a._id}`}
                                                    label={a.title}
                                                    subtitle={a.summary || undefined}
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-[18px]">
                                                {a.icon || '🏆'}
                                            </td>
                                            <td className="px-3 py-2">
                                                <ZoruBadge variant="warning" className="capitalize">
                                                    {a.frequency}
                                                </ZoruBadge>
                                            </td>
                                            <td className="px-3 py-2 text-zoru-ink-muted">{nominations}</td>
                                            <td className="px-3 py-2">
                                                <StatusPill label="Active" tone="green" />
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <ZoruButton
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setDeleteId(a._id)}
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
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={(o) => !o && setDeleteId(null)}
                title="Delete this award program?"
                description="The program will be permanently removed. Existing appreciations are kept but lose their program reference."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleDelete}
            />
        </>
    );
}

export default AwardsListClient;
