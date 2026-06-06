'use client';
import { fmtDate } from '@/lib/utils';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
import {
  Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * HR Probation — list page.
 *
 * Settings-style list with search + status filter and an inline-rendered
 * table. The "New probation" CTA links to the dedicated `/new` page.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { EnumFilterField } from '@/components/crm/enum-filter-field';

import {
    deleteCrmProbation,
    getCrmProbations,
    type CrmProbationDoc,
    type ProbationStatus,
} from '@/app/actions/crm-probation.actions';

const BASE = '/dashboard/hrm/hr/probation';

const STATUS_TONE: Record<ProbationStatus, StatusTone> = {
    in_progress: 'blue',
    confirmed: 'green',
    extended: 'amber',
    terminated: 'red',
    archived: 'neutral',
};

function statusLabel(s: string): string {
    return s.replace(/_/g, ' ');
}



function rowId(p: CrmProbationDoc & { _id?: unknown }): string {
    const v = p._id as unknown;
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && v && 'toString' in v) {
        return (v as { toString(): string }).toString();
    }
    return String(v);
}

export default function ProbationListPage() {
    const [probations, setProbations] = React.useState<CrmProbationDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<ProbationStatus | 'all'>(
        'all',
    );
    const [pendingDelete, setPendingDelete] = React.useState<CrmProbationDoc | null>(
        null,
    );
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const items = await getCrmProbations({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
            });
            setProbations(items ?? []);
        } catch {
            setProbations([]);
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
        const id = rowId(pendingDelete);
        startDeleteTransition(async () => {
            const result = await deleteCrmProbation(id);
            if (result.success) {
                toast({ title: 'Probation archived' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not archive probation.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <EntityListShell
                    title="Probation"
                    subtitle="Track probation periods, evaluation criteria and outcomes."
                    primaryAction={
                        <Button asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New probation
                            </Link>
                        </Button>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search by employee or evaluator…',
                    }}
                    filters={
                        <EnumFilterField
                            enumName="probationStatus"
                            value={statusFilter}
                            onChange={(v) => setStatusFilter(v as ProbationStatus | 'all')}
                            allLabel="All statuses"
                        />
                    }
                    loading={isLoading && probations.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">Employee</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Evaluator</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Start</Th>
                                    <Th className="text-[var(--st-text-secondary)]">End</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Score</Th>
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
                                ) : probations.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={7}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No probations match this filter.
                                        </Td>
                                    </Tr>
                                ) : (
                                    probations.map((p) => {
                                        const id = rowId(p);
                                        const status = (p.status ?? 'in_progress') as ProbationStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <Tr key={id} className="border-[var(--st-border)]">
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${id}`}
                                                        className="hover:underline"
                                                    >
                                                        {p.employeeName || p.employeeId || '—'}
                                                    </Link>
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {p.evaluatorName || p.evaluatorId || '—'}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtDate(p.startDate)}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtDate(p.endDate)}
                                                </Td>
                                                <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                                    {p.overallScore != null ? p.overallScore : '—'}
                                                </Td>
                                                <Td>
                                                    <StatusPill label={statusLabel(status)} tone={tone} />
                                                </Td>
                                                <Td className="text-right">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(p)}
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
                        <AlertDialogTitle>Archive probation?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Archiving will hide this probation from the active list. You
                            can still view it from the archived filter.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deletePending}>
                            {deletePending ? 'Archiving…' : 'Archive'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
