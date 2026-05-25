import { fmtDate } from '@/lib/utils';
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
  Button,
  Table,
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

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : fmtDate(d);
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
    const { toast } = useZoruToast();

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
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Evaluator</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Start</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">End</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Score</ZoruTableHead>
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
                                ) : probations.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={7}
                                            className="h-24 text-center text-zoru-ink-muted"
                                        >
                                            No probations match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    probations.map((p) => {
                                        const id = rowId(p);
                                        const status = (p.status ?? 'in_progress') as ProbationStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <ZoruTableRow key={id} className="border-zoru-line">
                                                <ZoruTableCell className="font-medium text-zoru-ink">
                                                    <Link
                                                        href={`${BASE}/${id}`}
                                                        className="hover:underline"
                                                    >
                                                        {p.employeeName || p.employeeId || '—'}
                                                    </Link>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {p.evaluatorName || p.evaluatorId || '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {fmtDate(p.startDate)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {fmtDate(p.endDate)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                                    {p.overallScore != null ? p.overallScore : '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill label={statusLabel(status)} tone={tone} />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
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
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })
                                )}
                            </ZoruTableBody>
                        </Table>
                    </div>
            </EntityListShell>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Archive probation?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Archiving will hide this probation from the active list. You
                            can still view it from the archived filter.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={handleDelete} disabled={deletePending}>
                            {deletePending ? 'Archiving…' : 'Archive'}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
