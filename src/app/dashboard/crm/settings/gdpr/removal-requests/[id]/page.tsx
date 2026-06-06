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
  Badge,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Label,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useParams,
  useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Loader2,
  PlayCircle,
  ShieldOff,
  XCircle,
  } from 'lucide-react';

/**
 * GDPR Erase Request — detail page.
 *
 * Shows the request metadata, the dry-run report (if computed), the
 * legal-hold gate, and the execution log. Execute is only enabled
 * when the request is `approved` AND a dry-run report exists. The
 * actual deletion mutation is env-gated server-side
 * (`GDPR_EXECUTION_ENABLED=true`) — see
 * `docs/ops/gdpr-erasure.md`.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

import {
    approveEraseRequest,
    dryRunEraseRequest,
    executeEraseRequest,
    getEraseRequestById,
    rejectEraseRequest,
    type CrmEraseRequestDTO,
    type EraseStatus,
} from '@/app/actions/crm-erase-requests.actions';

/* ── Tone map ─────────────────────────────────────────────────────── */

const STATUS_TONE: Record<EraseStatus, 'warning' | 'success' | 'danger' | 'info'> = {
    pending: 'warning',
    approved: 'info',
    rejected: 'danger',
    executing: 'info',
    executed: 'success',
    failed: 'danger',
};

function fmtDate(iso?: string): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return '—';
    }
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default function GdprEraseRequestDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const { toast } = useZoruToast();
    const id = params?.id ?? '';
    const [row, setRow] = React.useState<CrmEraseRequestDTO | null>(null);
    const [isLoading, startLoading] = React.useTransition();
    const [isPending, startPending] = React.useTransition();
    const [rejecting, setRejecting] = React.useState(false);
    const [rejectReason, setRejectReason] = React.useState('');
    const [executing, setExecuting] = React.useState(false);

    const refresh = React.useCallback(() => {
        if (!id) return;
        startLoading(async () => {
            const data = await getEraseRequestById(id);
            setRow(data);
        });
    }, [id]);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    const onApprove = () => {
        startPending(async () => {
            const res = await approveEraseRequest(id);
            if (res.ok) {
                toast({ title: 'Approved', description: 'Erase request approved.' });
                refresh();
            } else {
                toast({
                    title: 'Approve failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const onDryRun = () => {
        startPending(async () => {
            const res = await dryRunEraseRequest(id);
            if (res.ok) {
                toast({
                    title: 'Dry-run complete',
                    description: `${res.report.totalRows} row(s) across ${res.report.collectionsScanned} collection(s).`,
                });
                refresh();
            } else {
                toast({
                    title: 'Dry-run failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const onExecuteConfirm = () => {
        setExecuting(false);
        startPending(async () => {
            const res = await executeEraseRequest(id, { confirm: true });
            if (res.ok) {
                toast({
                    title: res.mode === 'mutated' ? 'Executed' : 'Logged (env-gated)',
                    description:
                        res.mode === 'mutated'
                            ? 'Erase request executed and data mutated.'
                            : 'Execution path walked; mutation skipped (GDPR_EXECUTION_ENABLED is not true).',
                });
                refresh();
            } else {
                toast({
                    title: 'Execute failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const confirmReject = () => {
        const reason = rejectReason.trim();
        if (!reason) {
            toast({
                title: 'Reason required',
                description: 'Please supply a rejection reason.',
                variant: 'destructive',
            });
            return;
        }
        startPending(async () => {
            const res = await rejectEraseRequest(id, reason);
            if (res.ok) {
                toast({ title: 'Rejected', description: 'Erase request rejected.' });
                setRejecting(false);
                setRejectReason('');
                refresh();
            } else {
                toast({
                    title: 'Reject failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    if (isLoading && !row) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (!row) {
        return (
            <EntityDetailShell
                eyebrow="GDPR"
                title="Erase request not found"
                back={{
                    href: '/dashboard/crm/settings/gdpr/removal-requests',
                    label: 'Erase Requests',
                }}
            >
                <Button variant="outline" asChild>
                    <Link href="/dashboard/crm/settings/gdpr/removal-requests">
                        Back to list
                    </Link>
                </Button>
            </EntityDetailShell>
        );
    }

    const canApprove = row.status === 'pending' && !row.legalHold;
    const canReject = row.status === 'pending' || row.status === 'approved';
    const canDryRun = row.status === 'pending' || row.status === 'approved';
    const canExecute =
        row.status === 'approved' && !row.legalHold && Boolean(row.dryRunReport);

    return (
        <EntityDetailShell
            eyebrow="GDPR"
            title={`Erase: ${row.subjectName}`}
            status={{ label: row.status, tone: STATUS_TONE[row.status] === 'success' ? 'green' : STATUS_TONE[row.status] === 'warning' ? 'amber' : STATUS_TONE[row.status] === 'danger' ? 'red' : 'blue' }}
            back={{
                href: '/dashboard/crm/settings/gdpr/removal-requests',
                label: 'Erase Requests',
            }}
        >
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_TONE[row.status]}>{row.status}</Badge>
                {row.legalHold ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--st-danger-soft)] px-3 py-1 text-xs text-[var(--st-danger)]">
                        <ShieldOff className="h-3.5 w-3.5" />
                        Legal hold active — execution blocked
                    </span>
                ) : null}

                <div className="ml-auto flex flex-wrap items-center gap-2">
                    {canApprove ? (
                        <Button
                            disabled={isPending}
                            onClick={onApprove}
                            aria-label="Approve"
                        >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Approve
                        </Button>
                    ) : null}
                    {canReject ? (
                        <Button
                            variant="outline"
                            disabled={isPending}
                            onClick={() => setRejecting(true)}
                            aria-label="Reject"
                        >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                        </Button>
                    ) : null}
                    {canDryRun ? (
                        <Button
                            variant="outline"
                            disabled={isPending}
                            onClick={onDryRun}
                            aria-label="Dry-run"
                        >
                            {isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Dry-run
                        </Button>
                    ) : null}
                    {canExecute ? (
                        <Button
                            disabled={isPending}
                            onClick={() => setExecuting(true)}
                            aria-label="Execute"
                        >
                            <PlayCircle className="mr-2 h-4 w-4" />
                            Execute
                        </Button>
                    ) : null}
                </div>
            </div>

            {/* Metadata card */}
            <Card className="p-6">
                <h2 className="mb-3 text-sm font-semibold text-[var(--st-text)]">Request metadata</h2>
                <dl className="grid grid-cols-1 gap-3 text-[13px] md:grid-cols-2">
                    <div>
                        <dt className="text-[var(--st-text-secondary)]">Subject</dt>
                        <dd className="text-[var(--st-text)]">
                            {row.subjectName}
                            {row.subjectEmail ? ` · ${row.subjectEmail}` : ''}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-[var(--st-text-secondary)]">Subject ID</dt>
                        <dd className="font-mono text-[var(--st-text)]">{row.subjectId}</dd>
                    </div>
                    <div>
                        <dt className="text-[var(--st-text-secondary)]">Requested by</dt>
                        <dd className="text-[var(--st-text)]">
                            {row.requestedByName ?? row.requestedBy}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-[var(--st-text-secondary)]">Requested at</dt>
                        <dd className="text-[var(--st-text)]">{fmtDate(row.requestedAt)}</dd>
                    </div>
                    {row.approverName ? (
                        <div>
                            <dt className="text-[var(--st-text-secondary)]">
                                {row.status === 'rejected' ? 'Rejected by' : 'Approved by'}
                            </dt>
                            <dd className="text-[var(--st-text)]">{row.approverName}</dd>
                        </div>
                    ) : null}
                    {row.approvedAt ? (
                        <div>
                            <dt className="text-[var(--st-text-secondary)]">Approved at</dt>
                            <dd className="text-[var(--st-text)]">{fmtDate(row.approvedAt)}</dd>
                        </div>
                    ) : null}
                    {row.rejectedAt ? (
                        <div>
                            <dt className="text-[var(--st-text-secondary)]">Rejected at</dt>
                            <dd className="text-[var(--st-text)]">{fmtDate(row.rejectedAt)}</dd>
                        </div>
                    ) : null}
                    {row.executedAt ? (
                        <div>
                            <dt className="text-[var(--st-text-secondary)]">Executed at</dt>
                            <dd className="text-[var(--st-text)]">{fmtDate(row.executedAt)}</dd>
                        </div>
                    ) : null}
                    {row.executionMode ? (
                        <div>
                            <dt className="text-[var(--st-text-secondary)]">Execution mode</dt>
                            <dd className="text-[var(--st-text)]">
                                {row.executionMode === 'mutated'
                                    ? 'Mutated (data changed)'
                                    : 'Env-gated (logged only)'}
                            </dd>
                        </div>
                    ) : null}
                    {row.reason ? (
                        <div className="md:col-span-2">
                            <dt className="text-[var(--st-text-secondary)]">Reason</dt>
                            <dd className="text-[var(--st-text)]">{row.reason}</dd>
                        </div>
                    ) : null}
                    {row.rejectionReason ? (
                        <div className="md:col-span-2">
                            <dt className="text-[var(--st-text-secondary)]">Rejection reason</dt>
                            <dd className="text-[var(--st-text)]">{row.rejectionReason}</dd>
                        </div>
                    ) : null}
                </dl>
            </Card>

            {/* Dry-run report */}
            <Card className="p-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-[var(--st-text)]">Dry-run report</h2>
                    {row.dryRunReport ? (
                        <span className="text-[12px] text-[var(--st-text-secondary)]">
                            Generated {fmtDate(row.dryRunReport.generatedAt)} ·{' '}
                            {row.dryRunReport.totalRows.toLocaleString()} row(s) across{' '}
                            {row.dryRunReport.collectionsScanned} collection(s)
                        </span>
                    ) : (
                        <span className="text-[12px] text-[var(--st-text-secondary)]">
                            Not run yet — required before execution.
                        </span>
                    )}
                </div>
                {row.dryRunReport ? (
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow className="hover:bg-transparent">
                                    <ZoruTableHead className="text-[var(--st-text-secondary)]">
                                        Collection
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">
                                        Rows
                                    </ZoruTableHead>
                                    <ZoruTableHead className="text-[var(--st-text-secondary)]">
                                        Sample IDs
                                    </ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {row.dryRunReport.rowsAffected.map((r) => (
                                    <ZoruTableRow key={r.collection}>
                                        <ZoruTableCell className="font-mono text-[12px] text-[var(--st-text)]">
                                            {r.collection}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[13px] text-[var(--st-text)]">
                                            {r.count.toLocaleString()}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-mono text-[11px] text-[var(--st-text-secondary)]">
                                            {r.sampleIds.length === 0
                                                ? '—'
                                                : r.sampleIds.join(', ')}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </Table>
                    </div>
                ) : null}
            </Card>

            {/* Execution log */}
            {row.executionLog && row.executionLog.length > 0 ? (
                <Card className="p-6">
                    <h2 className="mb-3 text-sm font-semibold text-[var(--st-text)]">
                        Execution log
                    </h2>
                    <pre className="max-h-96 overflow-auto rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-[11px] leading-relaxed text-[var(--st-text)]">
                        {row.executionLog.join('\n')}
                    </pre>
                </Card>
            ) : null}

            {/* Reject dialog */}
            <Dialog
                open={rejecting}
                onOpenChange={(o) => {
                    if (!o) {
                        setRejecting(false);
                        setRejectReason('');
                    }
                }}
            >
                <ZoruDialogContent className="max-w-lg">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Reject erase request</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Reason is required and is recorded in the chained-hash audit
                            ledger.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="reject-reason-detail">Reason</Label>
                        <Textarea
                            id="reject-reason-detail"
                            rows={3}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Outstanding legal obligation under tax law…"
                        />
                    </div>
                    <ZoruDialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setRejecting(false);
                                setRejectReason('');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            disabled={isPending}
                            onClick={confirmReject}
                        >
                            {isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Reject
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>

            {/* Execute confirmation */}
            <ZoruAlertDialog
                open={executing}
                onOpenChange={(o) => !o && setExecuting(false)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Execute erase?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            This action {row.scope === 'hard_delete' ? 'deletes' : 'redacts PII in'}{' '}
                            {row.dryRunReport?.totalRows.toLocaleString() ?? 'all matched'} row(s)
                            across {row.dryRunReport?.collectionsScanned ?? 'multiple'} collection(s).{' '}
                            <strong>This cannot be undone.</strong> If{' '}
                            <code>GDPR_EXECUTION_ENABLED</code> is not <code>true</code>, the
                            execution path is walked but no rows are mutated — the audit ledger
                            still records the attempt.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={onExecuteConfirm}>
                            {isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <PlayCircle className="mr-2 h-4 w-4" />
                            )}
                            Execute
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </EntityDetailShell>
    );
}
