'use client';

import {
    Button,
    Card,
    Input,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui';
import { LayoutDashboard, Lock, Plus, Search, Share2, Star } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';

export type SerializedDashboard = {
    _id: string;
    title?: string;
    ownerName?: string;
    ownerId?: string;
    widgets?: unknown[];
    sharedWith?: unknown;
    shareScope?: string;
    isDefault?: boolean;
    updatedAt?: string;
    createdAt?: string;
};

function formatDateTime(value: string | undefined | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
}

function renderSharedWith(value: unknown, scope?: string): string {
    if (Array.isArray(value)) {
        if (value.length === 0) return scope || '—';
        if (value.length <= 3) return value.map((v) => String(v)).join(', ');
        return `${value.length} members`;
    }
    if (typeof value === 'string' && value.trim()) return value;
    if (scope && scope.trim()) return scope;
    return '—';
}

function isShared(d: SerializedDashboard): boolean {
    const sw = d.sharedWith;
    const scope = d.shareScope ?? '';
    if (Array.isArray(sw) && sw.length > 0) return true;
    if (typeof sw === 'string' && sw.trim()) return true;
    if (scope && scope !== 'private') return true;
    return false;
}

function KpiCard({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: number | string;
}) {
    return (
        <ZoruCard className="p-5">
            <div className="flex items-center gap-2 text-zoru-ink-muted">
                {icon}
                <p className="text-[12.5px] font-medium">{label}</p>
            </div>
            <div className="mt-2 text-[22px] font-semibold text-zoru-ink">
                {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
        </ZoruCard>
    );
}

export function DashboardsList({
    dashboards,
    loadError,
}: {
    dashboards: SerializedDashboard[];
    loadError: boolean;
}) {
    const [search, setSearch] = React.useState('');

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return dashboards;
        return dashboards.filter((d) => {
            const title = (d.title ?? '').toLowerCase();
            const owner = String(d.ownerName ?? d.ownerId ?? '').toLowerCase();
            return title.includes(q) || owner.includes(q);
        });
    }, [dashboards, search]);

    const totalShared = dashboards.filter(isShared).length;
    const totalPrivate = dashboards.length - totalShared;
    const totalDefault = dashboards.filter((d) => Boolean(d.isDefault)).length;

    return (
        <EntityListShell
            title="Custom Dashboards"
            subtitle="Build your own dashboards with the metrics that matter to your team."
            primaryAction={
                <Link href="/dashboard/crm/dashboards/new">
                    <ZoruButton variant="outline">
                        <Plus className="h-4 w-4" strokeWidth={1.75} />
                        New dashboard
                    </ZoruButton>
                </Link>
            }
        >
            {/* KPI strip */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    icon={<LayoutDashboard className="h-4 w-4" />}
                    label="Total dashboards"
                    value={dashboards.length}
                />
                <KpiCard
                    icon={<Share2 className="h-4 w-4" />}
                    label="Shared"
                    value={totalShared}
                />
                <KpiCard
                    icon={<Lock className="h-4 w-4" />}
                    label="Private"
                    value={totalPrivate}
                />
                <KpiCard
                    icon={<Star className="h-4 w-4" />}
                    label="Default"
                    value={totalDefault}
                />
            </div>

            <ZoruCard className="p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] text-zoru-ink">All dashboards</h2>
                        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                            Boards owned by you or shared with your team.
                        </p>
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zoru-ink-muted" />
                        <ZoruInput
                            placeholder="Search by title or owner…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 text-[13px]"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Owner</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Widgets</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Shared with</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Updated</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {loadError ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={5}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        Could not load dashboards. Please try again.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : filtered.length > 0 ? (
                                filtered.map((d) => {
                                    const owner = d.ownerName || d.ownerId || '—';
                                    const widgetCount = Array.isArray(d.widgets) ? d.widgets.length : 0;
                                    return (
                                        <ZoruTableRow key={d._id} className="border-zoru-line">
                                            <ZoruTableCell className="text-zoru-ink">
                                                <EntityRowLink
                                                    href={`/dashboard/crm/dashboards/${d._id}`}
                                                    label={d.title || 'Untitled dashboard'}
                                                />
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">{owner}</ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {widgetCount}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {renderSharedWith(d.sharedWith, d.shareScope)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {formatDateTime(d.updatedAt)}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })
                            ) : (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={5}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        {search
                                            ? 'No dashboards match this search.'
                                            : 'No dashboards yet. Build your first board with the widgets that matter to your team.'}
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </EntityListShell>
    );
}
