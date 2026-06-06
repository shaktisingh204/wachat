'use client';

import { Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Label, StatCard, Table, TBody, Td, Th, THead, Tr, Textarea, cn, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import {
    UserMinus,
  Plus,
  Eye,
  CheckCircle2,
  XCircle,
  ShieldOff,
  Loader2,
  } from 'lucide-react';

/**
 * GDPR Erase Requests — list page (CRM_REBUILD_PLAN §6.9).
 *
 * Replaces the legacy WorkSuite-side removal-requests view. Subjects
 * here are CRM-native: contact / lead / employee. Lifecycle is
 *   pending → approved → executing → executed
 *               ↘ rejected
 *               ↘ failed (e.g. legal hold blocked)
 *
 * Mutations route through `src/app/actions/crm-erase-requests.actions.ts`
 * which writes every state transition to the chained-hash audit
 * ledger. The UI is intentionally read-light and link-heavy: detail
 * + dry-run + execute all live on `[id]/page.tsx`.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';

import {
    approveEraseRequest,
    dryRunEraseRequest,
    getEraseRequests,
    rejectEraseRequest,
    type CrmEraseRequestDTO,
    type EraseStatus,
    type EraseSubjectKind,
} from '@/app/actions/crm-erase-requests.actions';

/* ── Tone maps ────────────────────────────────────────────────────── */

const STATUS_TONE: Record<EraseStatus, 'warning' | 'success' | 'danger' | 'info'> = {
    pending: 'warning',
    approved: 'info',
    rejected: 'danger',
    executing: 'info',
    executed: 'success',
    failed: 'danger',
};

const STATUS_OPTIONS: { value: EraseStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'executing', label: 'Executing' },
    { value: 'executed', label: 'Executed' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'failed', label: 'Failed' },
];

const SUBJECT_OPTIONS: { value: EraseSubjectKind | 'all'; label: string }[] = [
    { value: 'all', label: 'All subjects' },
    { value: 'contact', label: 'Contacts' },
    { value: 'lead', label: 'Leads' },
    { value: 'employee', label: 'Employees' },
];

/* ── Helpers ──────────────────────────────────────────────────────── */

function fmtDate(iso?: string): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return '—';
    }
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default function GdprEraseRequestsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [rows, setRows] = React.useState<CrmEraseRequestDTO[]>([]);
    const [isLoading, startLoading] = React.useTransition();
    const [isPending, startPending] = React.useTransition();
    const [status, setStatus] = React.useState<EraseStatus | 'all'>('all');
    const [subjectKind, setSubjectKind] = React.useState<EraseSubjectKind | 'all'>('all');
    const [search, setSearch] = React.useState('');
    const [rejecting, setRejecting] = React.useState<string | null>(null);
    const [rejectReason, setRejectReason] = React.useState('');

    const refresh = React.useCallback(() => {
        startLoading(async () => {
            try {
                const data = await getEraseRequests({
                    status,
                    subjectKind,
                    search: search.trim() || undefined,
                });
                setRows(data);
            } catch (e) {
                console.error('[GdprEraseRequestsPage] load failed:', e);
            }
        });
    }, [status, subjectKind, search]);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    // KPI counters — derive from the in-memory rows so changing filters
    // updates them; for the full picture the user clears filters.
    const counts = React.useMemo(() => {
        const c = { pending: 0, approved: 0, executed: 0, legalHoldBlocked: 0 };
        for (const r of rows) {
            if (r.status === 'pending') c.pending += 1;
            else if (r.status === 'approved' || r.status === 'executing') c.approved += 1;
            else if (r.status === 'executed') c.executed += 1;
            if (r.legalHold) c.legalHoldBlocked += 1;
        }
        return c;
    }, [rows]);

    const onApprove = (id: string) => {
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

    const onDryRun = (id: string) => {
        startPending(async () => {
            const res = await dryRunEraseRequest(id);
            if (res.ok) {
                toast({
                    title: 'Dry-run complete',
                    description: `${res.report.totalRows} row(s) across ${res.report.collectionsScanned} collection(s).`,
                });
                router.push(`/dashboard/crm/settings/gdpr/removal-requests/${id}`);
            } else {
                toast({
                    title: 'Dry-run failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const confirmReject = () => {
        if (!rejecting) return;
        const id = rejecting;
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
                setRejecting(null);
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

    const renderRowActions = (row: CrmEraseRequestDTO) => (
        <div className="flex items-center justify-end gap-1">
            <Button
                variant="ghost"
                size="sm"
                asChild
                aria-label="View"
            >
                <Link href={`/dashboard/crm/settings/gdpr/removal-requests/${row._id}`}>
                    <Eye className="h-3.5 w-3.5" />
                </Link>
            </Button>
            {row.status === 'pending' ? (
                <>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending || row.legalHold}
                        onClick={() => onApprove(row._id)}
                        aria-label="Approve"
                        title={row.legalHold ? 'Subject under legal hold' : undefined}
                    >
                        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--st-status-ok)]" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => setRejecting(row._id)}
                        aria-label="Reject"
                    >
                        <XCircle className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                    </Button>
                </>
            ) : null}
            {(row.status === 'pending' || row.status === 'approved') ? (
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => onDryRun(row._id)}
                    aria-label="Dry-run"
                    title="Compute dry-run report"
                >
                    {isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        'Dry-run'
                    )}
                </Button>
            ) : null}
        </div>
    );

    const empty = (
        <div className="space-y-3 py-6">
            <UserMinus className="mx-auto h-8 w-8 text-[var(--st-text-secondary)]" />
            <p className="text-sm text-[var(--st-text-secondary)]">
                No GDPR erase requests yet. Subjects can request erasure under GDPR Art. 17.
            </p>
            <Button asChild>
                <Link href="/dashboard/crm/settings/gdpr/removal-requests/new">
                    <Plus className="mr-2 h-4 w-4" />
                    File a request
                </Link>
            </Button>
        </div>
    );

    return (
        <div className="flex w-full flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard label="Pending" value={counts.pending.toLocaleString()} />
                <StatCard label="Approved" value={counts.approved.toLocaleString()} />
                <StatCard label="Executed" value={counts.executed.toLocaleString()} />
                <StatCard
                    label="Legal-hold blocked"
                    value={counts.legalHoldBlocked.toLocaleString()}
                />
            </div>

            <EntityListShell
                title="GDPR Erase Requests"
                subtitle="Right-to-be-forgotten workflow for CRM subjects (Art. 17)."
                primaryAction={
                    <Button asChild>
                        <Link href="/dashboard/crm/settings/gdpr/removal-requests/new">
                            <Plus className="mr-2 h-4 w-4" />
                            New request
                        </Link>
                    </Button>
                }
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: 'Search subject name / email / reason…',
                }}
                filters={
                    <>
                        <div className="flex flex-wrap items-center gap-1">
                            {STATUS_OPTIONS.map((o) => (
                                <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => setStatus(o.value)}
                                    className={cn(
                                        'rounded-full border border-[var(--st-border)] px-3 py-1 text-xs transition-colors',
                                        status === o.value
                                            ? 'bg-[var(--st-text)] text-[var(--st-bg)]'
                                            : 'bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
                                    )}
                                >
                                    {o.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                            {SUBJECT_OPTIONS.map((o) => (
                                <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => setSubjectKind(o.value)}
                                    className={cn(
                                        'rounded-full border border-[var(--st-border)] px-3 py-1 text-xs transition-colors',
                                        subjectKind === o.value
                                            ? 'bg-[var(--st-text)] text-[var(--st-bg)]'
                                            : 'bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
                                    )}
                                >
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    </>
                }
                loading={isLoading && rows.length === 0}
                empty={!isLoading && rows.length === 0 ? empty : undefined}
            >
                <Card className="overflow-x-auto p-0">
                    <Table>
                        <THead>
                            <Tr className="hover:bg-transparent">
                                <Th className="text-[var(--st-text-secondary)]">
                                    Subject
                                </Th>
                                <Th className="text-[var(--st-text-secondary)]">
                                    Kind
                                </Th>
                                <Th className="text-[var(--st-text-secondary)]">
                                    Scope
                                </Th>
                                <Th className="text-[var(--st-text-secondary)]">
                                    Status
                                </Th>
                                <Th className="text-[var(--st-text-secondary)]">
                                    Hold
                                </Th>
                                <Th className="text-[var(--st-text-secondary)]">
                                    Requested
                                </Th>
                                <Th className="w-[260px] text-right text-[var(--st-text-secondary)]">
                                    Actions
                                </Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {rows.map((row) => (
                                <Tr key={row._id}>
                                    <Td>
                                        <div className="flex flex-col">
                                            <Link
                                                href={`/dashboard/crm/settings/gdpr/removal-requests/${row._id}`}
                                                className="text-[13px] font-medium text-[var(--st-text)] hover:underline"
                                            >
                                                {row.subjectName}
                                            </Link>
                                            {row.subjectEmail ? (
                                                <span className="text-[12px] text-[var(--st-text-secondary)]">
                                                    {row.subjectEmail}
                                                </span>
                                            ) : null}
                                        </div>
                                    </Td>
                                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
                                        {row.subjectKind}
                                    </Td>
                                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
                                        {row.scope === 'hard_delete' ? 'Hard delete' : 'Soft redact'}
                                    </Td>
                                    <Td>
                                        <Badge variant={STATUS_TONE[row.status]}>
                                            {row.status}
                                        </Badge>
                                    </Td>
                                    <Td>
                                        {row.legalHold ? (
                                            <span className="inline-flex items-center gap-1 text-[12px] text-[var(--st-danger)]">
                                                <ShieldOff className="h-3.5 w-3.5" />
                                                Held
                                            </span>
                                        ) : (
                                            <span className="text-[12px] text-[var(--st-text-secondary)]">—</span>
                                        )}
                                    </Td>
                                    <Td className="text-[12px] text-[var(--st-text-secondary)]">
                                        {fmtDate(row.requestedAt)}
                                    </Td>
                                    <Td className="text-right">
                                        {renderRowActions(row)}
                                    </Td>
                                </Tr>
                            ))}
                        </TBody>
                    </Table>
                </Card>
            </EntityListShell>

            <Dialog
                open={rejecting !== null}
                onOpenChange={(o) => {
                    if (!o) {
                        setRejecting(null);
                        setRejectReason('');
                    }
                }}
            >
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Reject erase request</DialogTitle>
                        <DialogDescription>
                            Reason is required and is recorded in the audit ledger.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="reject-reason">Reason</Label>
                        <Textarea
                            id="reject-reason"
                            rows={3}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Outstanding legal obligation under tax law…"
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setRejecting(null);
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
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
