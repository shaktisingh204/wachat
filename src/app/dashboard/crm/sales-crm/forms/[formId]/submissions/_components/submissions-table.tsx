'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
    CheckCircle2,
    ShieldAlert,
    Archive,
    Eye,
    MoreHorizontal,
    Trash2,
    X,
    ListChecks,
} from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    Checkbox,
    DropdownMenu,
    ZoruDropdownMenuContent,
    ZoruDropdownMenuItem,
    ZoruDropdownMenuSeparator,
    ZoruDropdownMenuTrigger,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/zoruui';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
    updateSubmissionStatus,
    deleteSubmission,
} from '@/app/actions/crm-forms.actions';
import type { CrmFormSubmissionDoc } from '@/lib/rust-client/crm-form-submissions';

type StatusValue = 'new' | 'processed' | 'spam' | 'archived';

interface SubmissionsTableProps {
    formId: string;
    submissions: CrmFormSubmissionDoc[];
    fieldOrder: Array<{ name: string; label?: string }>;
    page: number;
    limit: number;
    hasMore: boolean;
    total: number;
}

const STATUS_VARIANT: Record<StatusValue, 'default' | 'success' | 'danger' | 'secondary'> = {
    new: 'default',
    processed: 'success',
    spam: 'danger',
    archived: 'secondary',
};

function safeHost(raw?: string): string {
    if (!raw) return '—';
    try {
        const u = new URL(raw);
        const path = u.pathname && u.pathname !== '/' ? u.pathname : '';
        return `${u.host}${path}`.slice(0, 48);
    } catch {
        return raw.slice(0, 48);
    }
}

function summarise(
    data: Record<string, unknown> | undefined,
    fieldOrder: Array<{ name: string; label?: string }>,
): string {
    if (!data) return '(empty)';
    const preferred = ['name', 'email', 'phone', 'company', 'organisation'];
    const picks: string[] = [];
    for (const key of preferred) {
        const v = data[key];
        if (v != null && String(v).trim() !== '') {
            picks.push(String(v));
            if (picks.length >= 3) break;
        }
    }
    if (picks.length < 3) {
        for (const f of fieldOrder) {
            if (preferred.includes(f.name)) continue;
            const v = data[f.name];
            if (v != null && String(v).trim() !== '') {
                picks.push(String(v));
                if (picks.length >= 3) break;
            }
        }
    }
    if (picks.length === 0) return '(empty)';
    return picks.join(' · ').slice(0, 120);
}

function fmtRelative(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return formatDistanceToNow(d, { addSuffix: true });
}

export function SubmissionsTable({
    formId,
    submissions,
    fieldOrder,
    page,
    limit,
    hasMore,
    total,
}: SubmissionsTableProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [pending, startTransition] = React.useTransition();

    const ids = React.useMemo(() => submissions.map((s) => String(s._id)), [submissions]);
    const headChecked =
        ids.length > 0 && ids.every((id) => selected.has(id));

    const toggleOne = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const toggleAll = (on: boolean) =>
        setSelected(on ? new Set(ids) : new Set());

    const bulkUpdate = (status: StatusValue) => {
        if (selected.size === 0) return;
        const targets = Array.from(selected);
        startTransition(async () => {
            let ok = 0;
            let failed = 0;
            for (const id of targets) {
                const res = await updateSubmissionStatus(id, status);
                if (res.success) ok += 1;
                else failed += 1;
            }
            toast({
                title: failed === 0
                    ? `${ok} submission${ok === 1 ? '' : 's'} updated`
                    : `${ok} updated · ${failed} failed`,
                variant: failed > 0 ? 'destructive' : undefined,
            });
            setSelected(new Set());
            router.refresh();
        });
    };

    const bulkDelete = () => {
        if (selected.size === 0) return;
        if (!confirm(`Delete ${selected.size} submission${selected.size === 1 ? '' : 's'}? This cannot be undone.`)) {
            return;
        }
        const targets = Array.from(selected);
        startTransition(async () => {
            let ok = 0;
            let failed = 0;
            for (const id of targets) {
                const res = await deleteSubmission(id);
                if (res.success) ok += 1;
                else failed += 1;
            }
            toast({
                title: failed === 0
                    ? `${ok} submission${ok === 1 ? '' : 's'} deleted`
                    : `${ok} deleted · ${failed} failed`,
                variant: failed > 0 ? 'destructive' : undefined,
            });
            setSelected(new Set());
            router.refresh();
        });
    };

    const singleAction = (id: string, status: StatusValue) => {
        startTransition(async () => {
            const res = await updateSubmissionStatus(id, status);
            if (res.success) {
                toast({ title: 'Status updated', description: `Marked as ${status}.` });
                router.refresh();
            } else {
                toast({
                    title: 'Update failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    const singleDelete = (id: string) => {
        if (!confirm('Delete this submission? This cannot be undone.')) return;
        startTransition(async () => {
            const res = await deleteSubmission(id);
            if (res.success) {
                toast({ title: 'Submission deleted' });
                router.refresh();
            } else {
                toast({
                    title: 'Delete failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    if (submissions.length === 0) {
        return (
            <Card className="flex min-h-[240px] items-center justify-center p-8">
                <div className="text-center">
                    <p className="text-[14px] font-medium text-zoru-ink">No submissions yet</p>
                    <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
                        Once people fill in your form, you&apos;ll see their responses here.
                    </p>
                    <div className="mt-3">
                        <Link
                            href={`/dashboard/crm/sales-crm/forms/${formId}/edit`}
                            className="text-[13px] font-medium text-zoru-primary hover:underline"
                        >
                            Edit the form →
                        </Link>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {selected.size > 0 ? (
                <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2 shadow-[var(--zoru-shadow-sm)]">
                    <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
                        <ListChecks className="h-4 w-4 text-zoru-primary" />
                        {selected.size} selected
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => bulkUpdate('processed')}
                            disabled={pending}
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Mark processed
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => bulkUpdate('spam')}
                            disabled={pending}
                        >
                            <ShieldAlert className="h-3.5 w-3.5" /> Spam
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => bulkUpdate('archived')}
                            disabled={pending}
                        >
                            <Archive className="h-3.5 w-3.5" /> Archive
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={bulkDelete}
                            disabled={pending}
                        >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelected(new Set())}
                            aria-label="Clear selection"
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            ) : null}

            <Card className="overflow-hidden p-0">
                <Table>
                    <ZoruTableHeader>
                        <ZoruTableRow>
                            <ZoruTableHead className="w-8">
                                <Checkbox
                                    checked={headChecked}
                                    onCheckedChange={(c) => toggleAll(Boolean(c))}
                                    aria-label="Select all"
                                />
                            </ZoruTableHead>
                            <ZoruTableHead>Submitted</ZoruTableHead>
                            <ZoruTableHead>Summary</ZoruTableHead>
                            <ZoruTableHead>Source</ZoruTableHead>
                            <ZoruTableHead>Status</ZoruTableHead>
                            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {submissions.map((s) => {
                            const id = String(s._id);
                            const checked = selected.has(id);
                            const status = (s.status ?? 'new') as StatusValue;
                            return (
                                <ZoruTableRow key={id}>
                                    <ZoruTableCell>
                                        <Checkbox
                                            checked={checked}
                                            onCheckedChange={() => toggleOne(id)}
                                            aria-label="Select submission"
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {fmtRelative(s.createdAt)}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <EntityRowLink
                                            href={`/dashboard/crm/sales-crm/forms/${formId}/submissions/${id}`}
                                            label={summarise(s.data as Record<string, unknown> | undefined, fieldOrder)}
                                            subtitle={`#${id.slice(-6)}`}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {safeHost(s.sourceUrl)}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <Badge variant={STATUS_VARIANT[status]}>
                                            {status}
                                        </Badge>
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <DropdownMenu>
                                            <ZoruDropdownMenuTrigger asChild>
                                                <Button size="sm" variant="ghost" aria-label="Row actions">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </ZoruDropdownMenuTrigger>
                                            <ZoruDropdownMenuContent align="end">
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link href={`/dashboard/crm/sales-crm/forms/${formId}/submissions/${id}`}>
                                                        <Eye className="h-4 w-4" /> View
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuSeparator />
                                                <ZoruDropdownMenuItem onClick={() => singleAction(id, 'processed')}>
                                                    <CheckCircle2 className="h-4 w-4" /> Mark processed
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem onClick={() => singleAction(id, 'spam')}>
                                                    <ShieldAlert className="h-4 w-4" /> Mark spam
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem onClick={() => singleAction(id, 'archived')}>
                                                    <Archive className="h-4 w-4" /> Archive
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuSeparator />
                                                <ZoruDropdownMenuItem
                                                    onClick={() => singleDelete(id)}
                                                    className="text-zoru-danger-ink"
                                                >
                                                    <Trash2 className="h-4 w-4" /> Delete
                                                </ZoruDropdownMenuItem>
                                            </ZoruDropdownMenuContent>
                                        </DropdownMenu>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            );
                        })}
                    </ZoruTableBody>
                </Table>
                <PaginationBar page={page} limit={limit} hasMore={hasMore} total={total} />
            </Card>
        </div>
    );
}
