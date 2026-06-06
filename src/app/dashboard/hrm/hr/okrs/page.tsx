'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Progress, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import {
  Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * OKRs — list page.
 *
 * Columns: Objective · Period · Owner · Progress% · Confidence · Status.
 * Search + status filter, inline-rendered Table, delete via AlertDialog.
 * Talks to the Rust-backed actions in `crm-okrs.actions.ts`.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { deleteOkr, getOkrs } from '@/app/actions/crm-okrs.actions';
import type { CrmOkrDoc, CrmOkrStatus } from '@/lib/rust-client/crm-okrs';

const BASE = '/dashboard/hrm/hr/okrs';

// §1E.sweep: OKR status Select kept — page uses 'behind'/'missed' slugs; okrStatus enum has 'off_track'/'cancelled'. Resolve Rust DTO first.
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
    const { toast } = useToast();

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
            <EntityListShell
                    title="OKRs"
                    subtitle="Objectives and key results — individual, team, and company level."
                    primaryAction={
                        <Button asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New OKR
                            </Link>
                        </Button>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search objectives…',
                    }}
                    filters={
                        <Select
                            value={statusFilter}
                            onValueChange={(v) => setStatusFilter(v as CrmOkrStatus | 'all')}
                        >
                            <SelectTrigger className="h-9 w-[180px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    }
                    loading={isLoading && okrs.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">Objective</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Period</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Owner</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Progress</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Confidence</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Status</Th>
                                    <Th className="text-[var(--st-text-secondary)] text-right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {isLoading ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td colSpan={7} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                        </Td>
                                    </Tr>
                                ) : okrs.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={7}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No OKRs match this filter.
                                        </Td>
                                    </Tr>
                                ) : (
                                    okrs.map((o) => {
                                        const status = (o.status ?? 'draft') as CrmOkrStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        const progress = clampPercent(o.progress);
                                        return (
                                            <Tr key={o._id} className="border-[var(--st-border)]">
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${o._id}`}
                                                        className="block max-w-[280px] truncate hover:underline"
                                                    >
                                                        {o.objective}
                                                    </Link>
                                                </Td>
                                                <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                                    {o.period ?? '—'}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {o.ownerName ?? o.ownerId ?? '—'}
                                                </Td>
                                                <Td className="min-w-[140px]">
                                                    <div className="flex items-center gap-2">
                                                        <Progress
                                                            value={progress}
                                                            className="h-2 w-24"
                                                        />
                                                        <span className="font-mono text-[11.5px] tabular-nums text-[var(--st-text)]">
                                                            {progress}%
                                                        </span>
                                                    </div>
                                                </Td>
                                                <Td className="font-mono text-[12px] tabular-nums text-[var(--st-text)]">
                                                    {typeof o.confidence === 'number'
                                                        ? `${clampPercent(o.confidence)}%`
                                                        : '—'}
                                                </Td>
                                                <Td>
                                                    <StatusPill label={statusLabel(status)} tone={tone} />
                                                </Td>
                                                <Td className="text-right">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${o._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(o)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                                    </Button>
                                                </Td>
                                            </Tr>
                                        );
                                    })
                                )}
                            </TBody>
                        </Table>
                    </div>
            </EntityListShell>

            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete OKR?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.objective}&rdquo; will remove it from
                            the active list. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deletePending}>
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
