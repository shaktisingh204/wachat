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
    Tag,
    Download,
} from 'lucide-react';

import { useVirtualizer } from '@tanstack/react-virtual';

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
} from '@/components/sabcrm/20ui/compat';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
    updateSubmissionStatus,
    deleteSubmission,
    updateSubmissionTags,
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

    const parentRef = React.useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: submissions.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 53, // approximate row height
        overscan: 5,
    });

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

    const bulkTag = () => {
        if (selected.size === 0) return;
        const tag = window.prompt('Enter a tag to add to selected submissions:');
        if (!tag || tag.trim() === '') return;
        const targets = Array.from(selected);
        startTransition(async () => {
            let ok = 0;
            let failed = 0;
            for (const id of targets) {
                const sub = submissions.find(s => String(s._id) === id);
                const existingTags = (sub?.tags as string[]) || [];
                const res = await updateSubmissionTags(id, Array.from(new Set([...existingTags, tag.trim()])));
                if (res.success) ok += 1;
                else failed += 1;
            }
            toast({
                title: failed === 0
                    ? `${ok} submission${ok === 1 ? '' : 's'} tagged`
                    : `${ok} tagged · ${failed} failed`,
                variant: failed > 0 ? 'destructive' : undefined,
            });
            setSelected(new Set());
            router.refresh();
        });
    };

    const bulkExport = () => {
        if (selected.size === 0) return;
        const targets = submissions.filter(s => selected.has(String(s._id)));
        const data = targets.map(t => {
            const row: Record<string, any> = { _id: t._id, status: t.status, createdAt: t.createdAt };
            if (t.data) {
                for (const [k, v] of Object.entries(t.data)) {
                    row[`data.${k}`] = v;
                }
            }
            return row;
        });
        
        const header = Array.from(new Set(data.flatMap(r => Object.keys(r))));
        const csv = [
            header.join(','),
            ...data.map(r => header.map(h => {
                const val = r[h];
                if (val == null) return '';
                const str = String(val);
                if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
                return str;
            }).join(','))
        ].join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `submissions_export_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Exported ' + targets.length + ' submissions.' });
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
                    <p className="text-[14px] font-medium text-[var(--st-text)]">No submissions yet</p>
                    <p className="mt-1 text-[12.5px] text-[var(--st-text-secondary)]">
                        Once people fill in your form, you&apos;ll see their responses here.
                    </p>
                    <div className="mt-3">
                        <Link
                            href={`/dashboard/crm/sales-crm/forms/${formId}/edit`}
                            className="text-[13px] font-medium text-[var(--st-text)] hover:underline"
                        >
                            Edit the form →
                        </Link>
                    </div>
                </div>
            </Card>
        );
    }

    const virtualItems = rowVirtualizer.getVirtualItems();
    const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
    const paddingBottom = virtualItems.length > 0 ? rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0) : 0;

    return (
        <div className="flex flex-col gap-3">
            {selected.size > 0 ? (
                <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 shadow-[var(--zoru-shadow-sm)]">
                    <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text)]">
                        <ListChecks className="h-4 w-4 text-[var(--st-text)]" />
                        {selected.size} selected
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={bulkExport}
                            disabled={pending}
                        >
                            <Download className="h-3.5 w-3.5" /> Export
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={bulkTag}
                            disabled={pending}
                        >
                            <Tag className="h-3.5 w-3.5" /> Tag
                        </Button>
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

            <Card className="overflow-hidden p-0 flex flex-col">
                <div ref={parentRef} className="max-h-[600px] overflow-auto relative">
                <Table>
                    <ZoruTableHeader className="sticky top-0 bg-[var(--st-bg-secondary)] z-10 shadow-sm">
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
                        {paddingTop > 0 && (
                            <tr><td style={{ height: `${paddingTop}px` }} /></tr>
                        )}
                        {virtualItems.map((virtualRow) => {
                            const s = submissions[virtualRow.index];
                            const id = String(s._id);
                            const checked = selected.has(id);
                            const status = (s.status ?? 'new') as StatusValue;
                            return (
                                <ZoruTableRow key={id} ref={rowVirtualizer.measureElement} data-index={virtualRow.index}>
                                    <ZoruTableCell>
                                        <Checkbox
                                            checked={checked}
                                            onCheckedChange={() => toggleOne(id)}
                                            aria-label="Select submission"
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-[var(--st-text-secondary)]">
                                        {fmtRelative(s.createdAt)}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <EntityRowLink
                                            href={`/dashboard/crm/sales-crm/forms/${formId}/submissions/${id}`}
                                            label={summarise(s.data as Record<string, unknown> | undefined, fieldOrder)}
                                            subtitle={`#${id.slice(-6)}`}
                                        />
                                        {s.tags && s.tags.length > 0 && (
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {s.tags.map(tag => (
                                                    <Badge key={tag} variant="secondary" className="text-[10px] px-1 py-0 h-4">{tag}</Badge>
                                                ))}
                                            </div>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-[var(--st-text-secondary)]">
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
                                                    className="text-[var(--st-danger)]"
                                                >
                                                    <Trash2 className="h-4 w-4" /> Delete
                                                </ZoruDropdownMenuItem>
                                            </ZoruDropdownMenuContent>
                                        </DropdownMenu>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            );
                        })}
                        {paddingBottom > 0 && (
                            <tr><td style={{ height: `${paddingBottom}px` }} /></tr>
                        )}
                    </ZoruTableBody>
                </Table>
                </div>
                <div className="p-2 border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                    <PaginationBar page={page} limit={limit} hasMore={hasMore} total={total} />
                </div>
            </Card>
        </div>
    );
}
