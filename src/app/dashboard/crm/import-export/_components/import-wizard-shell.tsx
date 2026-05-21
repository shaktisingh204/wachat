'use client';

/**
 * Drawer + recent-jobs table shell for the import-export landing page.
 *
 * Owns:
 *   • the "Start import" button → opens a side sheet hosting
 *     `<ImportWizard />`.
 *   • the recent imports table — loads from `listImportJobs`, refreshes
 *     on a 3 s interval while any job is queued/running.
 *
 * The wizard mounts with a key that we bump on each open so the user
 * always starts at step 1 with empty state.
 */

import * as React from 'react';
import {
    Download,
    PlusCircle,
    RefreshCcw,
    Trash2,
} from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruEmptyState,
    ZoruSheet,
    ZoruSheetContent,
    ZoruSheetDescription,
    ZoruSheetHeader,
    ZoruSheetTitle,
    ZoruTable,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui';
import {
    deleteImportJob,
    listImportJobs,
    type ImportJobStatus,
} from '@/app/actions/crm-import.actions';
import { ENTITY_SCHEMAS } from '@/lib/crm-import/entity-schemas';

import { ImportWizard } from './import-wizard';

interface ImportWizardShellProps {
    initialJobs: ImportJobStatus[];
}

const REFRESH_MS = 3000;

function formatDateTime(d: Date | string | null | undefined): string {
    if (!d) return '—';
    const date = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
}

function statusVariant(
    s: ImportJobStatus['status'],
): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (s) {
        case 'completed':
            return 'default';
        case 'failed':
            return 'destructive';
        case 'running':
        case 'queued':
            return 'secondary';
        default:
            return 'outline';
    }
}

export function ImportWizardShell({
    initialJobs,
}: ImportWizardShellProps): React.ReactElement {
    const [isOpen, setIsOpen] = React.useState(false);
    const [wizardKey, setWizardKey] = React.useState(0);
    const [jobs, setJobs] = React.useState<ImportJobStatus[]>(initialJobs);
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const refresh = React.useCallback(async (): Promise<void> => {
        setIsRefreshing(true);
        try {
            const next = await listImportJobs();
            setJobs(next);
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    /* Auto-poll while any job is in flight. */
    React.useEffect(() => {
        const hasActive = jobs.some(
            (j) => j.status === 'running' || j.status === 'queued',
        );
        if (!hasActive) return;
        const id = setInterval(() => {
            void refresh();
        }, REFRESH_MS);
        return (): void => clearInterval(id);
    }, [jobs, refresh]);

    const handleOpen = React.useCallback((): void => {
        setWizardKey((k) => k + 1);
        setIsOpen(true);
    }, []);

    const handleClose = React.useCallback((): void => {
        setIsOpen(false);
        void refresh();
    }, [refresh]);

    const handleDelete = React.useCallback(
        async (jobId: string): Promise<void> => {
            const res = await deleteImportJob(jobId);
            if (res.ok) void refresh();
        },
        [refresh],
    );

    return (
        <>
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h2 className="text-sm font-semibold text-zoru-ink">
                        Generic import wizard
                    </h2>
                    <p className="text-[12.5px] text-zoru-ink-muted">
                        Import employees, clients, leads, deals, products, expenses,
                        or attendance from a CSV or Excel file.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ZoruButton
                        variant="ghost"
                        size="sm"
                        onClick={() => void refresh()}
                        disabled={isRefreshing}
                        aria-label="Refresh recent imports"
                    >
                        <RefreshCcw
                            className={
                                isRefreshing
                                    ? 'h-3.5 w-3.5 animate-spin'
                                    : 'h-3.5 w-3.5'
                            }
                        />
                    </ZoruButton>
                    <ZoruButton onClick={handleOpen} size="sm">
                        <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                        Start import
                    </ZoruButton>
                </div>
            </div>

            <ZoruCard className="overflow-hidden">
                <div className="border-b border-zoru-line bg-zoru-surface-2 px-4 py-2 text-[12.5px] font-medium text-zoru-ink">
                    Recent imports
                </div>
                {jobs.length === 0 ? (
                    <div className="p-6">
                        <ZoruEmptyState
                            title="No imports yet"
                            description="Click “Start import” to upload your first file."
                        />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>File</ZoruTableHead>
                                    <ZoruTableHead>Entity</ZoruTableHead>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                    <ZoruTableHead>Progress</ZoruTableHead>
                                    <ZoruTableHead>Started</ZoruTableHead>
                                    <ZoruTableHead>Finished</ZoruTableHead>
                                    <ZoruTableHead className="w-32 text-right">
                                        Actions
                                    </ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {jobs.map((job) => {
                                    const schema = ENTITY_SCHEMAS[job.entityType];
                                    const total = job.totalRows || 0;
                                    const pct =
                                        total > 0
                                            ? Math.min(
                                                  100,
                                                  Math.round(
                                                      (job.processed / total) * 100,
                                                  ),
                                              )
                                            : 0;
                                    const canDelete =
                                        job.status === 'completed' ||
                                        job.status === 'failed';
                                    return (
                                        <ZoruTableRow key={job._id}>
                                            <ZoruTableCell className="max-w-[220px] truncate text-[12.5px] text-zoru-ink">
                                                {job.filename}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                                {schema?.label ?? job.entityType}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <ZoruBadge
                                                    variant={statusVariant(job.status)}
                                                >
                                                    {job.status}
                                                </ZoruBadge>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                                {job.processed}/{total} ({pct}%)
                                                {job.failed > 0 && (
                                                    <span className="ml-1 text-zoru-danger">
                                                        · {job.failed} failed
                                                    </span>
                                                )}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                                {formatDateTime(job.createdAt)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                                {formatDateTime(job.finishedAt)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {job.errors.length > 0 && (
                                                        <ZoruButton
                                                            asChild
                                                            variant="ghost"
                                                            size="sm"
                                                            aria-label="Download error log"
                                                        >
                                                            <a
                                                                href={`/api/import-jobs/${job._id}/errors`}
                                                            >
                                                                <Download className="h-3.5 w-3.5" />
                                                            </a>
                                                        </ZoruButton>
                                                    )}
                                                    {canDelete && (
                                                        <ZoruButton
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                void handleDelete(job._id)
                                                            }
                                                            aria-label="Delete import job"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </ZoruButton>
                                                    )}
                                                </div>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                )}
            </ZoruCard>

            <ZoruSheet
                open={isOpen}
                onOpenChange={(o) => {
                    if (!o) handleClose();
                    else setIsOpen(true);
                }}
            >
                <ZoruSheetContent className="w-full max-w-2xl overflow-y-auto">
                    <ZoruSheetHeader>
                        <ZoruSheetTitle>Import wizard</ZoruSheetTitle>
                        <ZoruSheetDescription>
                            Upload a CSV or Excel file and map its columns to the
                            target entity.
                        </ZoruSheetDescription>
                    </ZoruSheetHeader>
                    <div className="mt-4">
                        <ImportWizard
                            key={wizardKey}
                            onClose={handleClose}
                            onJobCreated={refresh}
                        />
                    </div>
                </ZoruSheetContent>
            </ZoruSheet>
        </>
    );
}
