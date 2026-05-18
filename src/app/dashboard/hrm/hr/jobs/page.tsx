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
  ZoruInput,
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
  Briefcase,
  Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * HR Jobs — list page.
 *
 * Canonical §1B contract: `EntityListShell` + `CrmPageHeader` +
 * `ZoruTable` with a search box, status / employment-type / department
 * filters, and inline delete via `ZoruAlertDialog`.
 */

import * as React from 'react';
import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { deleteJob, getJobs } from '@/app/actions/crm-jobs.actions';
import type {
    CrmJobDoc,
    CrmJobEmploymentType,
    CrmJobStatus,
} from '@/lib/rust-client/crm-jobs';

const BASE = '/dashboard/hrm/hr/jobs';

const STATUS_OPTIONS: Array<{ value: CrmJobStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'open', label: 'Open' },
    { value: 'on_hold', label: 'On hold' },
    { value: 'filled', label: 'Filled' },
    { value: 'closed', label: 'Closed' },
    { value: 'archived', label: 'Archived' },
];

const TYPE_OPTIONS: Array<{
    value: CrmJobEmploymentType | 'all';
    label: string;
}> = [
    { value: 'all', label: 'All types' },
    { value: 'full_time', label: 'Full-time' },
    { value: 'part_time', label: 'Part-time' },
    { value: 'contract', label: 'Contract' },
    { value: 'intern', label: 'Intern' },
    { value: 'temporary', label: 'Temporary' },
];

const STATUS_TONE: Record<CrmJobStatus, StatusTone> = {
    draft: 'amber',
    open: 'green',
    on_hold: 'amber',
    filled: 'blue',
    closed: 'red',
    archived: 'neutral',
};

function pretty(s: string | undefined): string {
    if (!s) return '—';
    return s.replace(/_/g, ' ');
}

export default function JobsListPage() {
    const [jobs, setJobs] = React.useState<CrmJobDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<
        CrmJobStatus | 'all'
    >('all');
    const [typeFilter, setTypeFilter] = React.useState<
        CrmJobEmploymentType | 'all'
    >('all');
    const [departmentFilter, setDepartmentFilter] = React.useState('');
    const [pendingDelete, setPendingDelete] =
        React.useState<CrmJobDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useZoruToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getJobs({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                employmentType: typeFilter === 'all' ? undefined : typeFilter,
                departmentId: departmentFilter.trim() || undefined,
                limit: 100,
            });
            setJobs(res.items ?? []);
        } catch {
            setJobs([]);
        } finally {
            setIsLoading(false);
        }
    }, [search, statusFilter, typeFilter, departmentFilter]);

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
            const result = await deleteJob(id);
            if (result.success) {
                toast({ title: 'Job deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete job.',
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
                        { label: 'Jobs' },
                    ]}
                    title="Jobs"
                    subtitle="Open requisitions and hiring pipelines."
                    icon={Briefcase}
                    actions={
                        <ZoruButton asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New job
                            </Link>
                        </ZoruButton>
                    }
                />

                <EntityListShell
                    title=""
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search jobs…',
                    }}
                    filters={
                        <>
                            <ZoruSelect
                                value={statusFilter}
                                onValueChange={(v) =>
                                    setStatusFilter(v as CrmJobStatus | 'all')
                                }
                            >
                                <ZoruSelectTrigger className="h-9 w-[160px]">
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
                            <ZoruSelect
                                value={typeFilter}
                                onValueChange={(v) =>
                                    setTypeFilter(
                                        v as CrmJobEmploymentType | 'all',
                                    )
                                }
                            >
                                <ZoruSelectTrigger className="h-9 w-[160px]">
                                    <ZoruSelectValue placeholder="Type" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {TYPE_OPTIONS.map((o) => (
                                        <ZoruSelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                            <ZoruInput
                                value={departmentFilter}
                                onChange={(e) =>
                                    setDepartmentFilter(e.target.value)
                                }
                                placeholder="Department id…"
                                className="h-9 w-[180px]"
                            />
                        </>
                    }
                    loading={isLoading && jobs.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Department</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Openings</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell colSpan={6} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : jobs.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={6}
                                            className="h-24 text-center text-zoru-ink-muted"
                                        >
                                            No jobs match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    jobs.map((j) => {
                                        const status = (j.status ?? 'draft') as CrmJobStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        const openings = j.openings ?? 0;
                                        const filled = j.filled ?? 0;
                                        return (
                                            <ZoruTableRow key={j._id} className="border-zoru-line">
                                                <ZoruTableCell className="font-medium text-zoru-ink">
                                                    <Link
                                                        href={`${BASE}/${j._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {j.title}
                                                    </Link>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {j.departmentName || j.departmentId || '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="capitalize text-zoru-ink">
                                                    {pretty(j.employmentType as string)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                                    {filled}/{openings}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill label={pretty(status)} tone={tone} />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <ZoruButton variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${j._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(j)}
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
                        <ZoruAlertDialogTitle>Delete job?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.title}&rdquo; will close the
                            requisition. Candidates already linked to this job remain
                            in the candidate pipeline.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
