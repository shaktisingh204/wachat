'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruButton,
  ZoruProgress,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  Edit,
  LoaderCircle,
  Plus,
  Target,
  Trash2 } from 'lucide-react';

/**
 * OKRs — list page.
 *
 * Columns: Objective · Period · Owner · Progress% · Confidence · Status.
 * Search + status filter, inline-rendered ZoruTable, delete via ZoruAlertDialog.
 * Talks to the Rust-backed actions in `crm-okrs.actions.ts`.
 */

import * as React from 'react';
import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { deleteOkr, getOkrs } from '@/app/actions/crm-okrs.actions';
import type { CrmOkrDoc, CrmOkrStatus } from '@/lib/rust-client/crm-okrs';

const BASE = '/dashboard/hrm/hr/okrs';

// §1E.sweep: OKR status ZoruSelect kept — page uses 'behind'/'missed' slugs; okrStatus enum has 'off_track'/'cancelled'. Resolve Rust DTO first.
const STATUS_OPTIONS: Array<{ value: CrmOkrStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'on_track', label: 'On track' },
    { value: 'at_risk', label: 'At risk' },
    { value: 'behind', label: 'Behind' },
    { value: 'completed', label: 'Completed' },
    { value: 'missed', label: 'Missed' },
    { value: 'archived', label: 'Archived' },
];

const STATUS_TONE: Record<CrmOkrStatus, StatusTone> = {
    draft: 'neutral',
    in_progress: 'blue',
    on_track: 'green',
    at_risk: 'amber',
    behind: 'red',
    completed: 'green',
    missed: 'red',
    archived: 'neutral',
};

function statusLabel(s: string): string {
    return s.replace(/_/g, ' ');
}

function clampPercent(n: unknown): number {
    const v = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, Math.round(v)));
}

export default function OkrsListPage() {
    const [okrs, setOkrs] = React.useState<CrmOkrDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<CrmOkrStatus | 'all'>('all');
    const [pendingDelete, setPendingDelete] = React.useState<CrmOkrDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useZoruToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getOkrs({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                limit: 100,
            });
            setOkrs(res.items ?? []);
        } catch {
            setOkrs([]);
        } finally {
            setIsLoading(false);
        }
    }, [search, statusFilter]);

    React.useEffect(() => {
        const t = window.setTimeout(() => {
            void refresh();
        }, 250);
        return () => window.clearTimeout(t);
    }, [refresh]);

    const handleDelete = () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        startDeleteTransition(async () => {
            const result = await deleteOkr(id);
            if (result.success) {
                toast({ title: 'OKR deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete OKR.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    breadcrumbs={[
                        { label: 'HR', href: '/dashboard/hrm/hr' },
                        { label: 'OKRs' },
                    ]}
                    title="OKRs"
                    subtitle="Objectives and key results — individual, team, and company level."
                    icon={Target}
                    actions={
                        <ZoruButton asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New OKR
                            </Link>
                        </ZoruButton>
                    }
                />

                <EntityListShell
                    title=""
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search objectives…',
                    }}
                    filters={
                        <ZoruSelect
                            value={statusFilter}
                            onValueChange={(v) => setStatusFilter(v as CrmOkrStatus | 'all')}
                        >
                            <ZoruSelectTrigger className="h-9 w-[180px]">
                                <ZoruSelectValue placeholder="Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    }
                    loading={isLoading && okrs.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Objective</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Period</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Owner</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Progress</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Confidence</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell colSpan={7} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : okrs.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={7}
                                            className="h-24 text-center text-zoru-ink-muted"
                                        >
                                            No OKRs match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    okrs.map((o) => {
                                        const status = (o.status ?? 'draft') as CrmOkrStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        const progress = clampPercent(o.progress);
                                        return (
                                            <ZoruTableRow key={o._id} className="border-zoru-line">
                                                <ZoruTableCell className="font-medium text-zoru-ink">
                                                    <Link
                                                        href={`${BASE}/${o._id}`}
                                                        className="block max-w-[280px] truncate hover:underline"
                                                    >
                                                        {o.objective}
                                                    </Link>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                                    {o.period ?? '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {o.ownerName ?? o.ownerId ?? '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="min-w-[140px]">
                                                    <div className="flex items-center gap-2">
                                                        <ZoruProgress
                                                            value={progress}
                                                            className="h-2 w-24"
                                                        />
                                                        <span className="font-mono text-[11.5px] tabular-nums text-zoru-ink">
                                                            {progress}%
                                                        </span>
                                                    </div>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-[12px] tabular-nums text-zoru-ink">
                                                    {typeof o.confidence === 'number'
                                                        ? `${clampPercent(o.confidence)}%`
                                                        : '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill label={statusLabel(status)} tone={tone} />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <ZoruButton variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${o._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(o)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </ZoruButton>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </EntityListShell>
            </div>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete OKR?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.objective}&rdquo; will remove it from
                            the active list. This action cannot be undone.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={handleDelete} disabled={deletePending}>
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
