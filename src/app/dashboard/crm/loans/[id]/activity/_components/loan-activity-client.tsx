'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent } from '@/components/zoruui';
import { Badge } from '@/components/zoruui';
import { Button } from '@/components/zoruui';
import { Textarea } from '@/components/zoruui';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/zoruui';
import { addManualLogEntry } from '../actions';
import { toast } from 'sonner';

interface AuditEntry {
    _id: string;
    actorId?: string;
    action: string;
    entityKind: string;
    reason?: string;
    diff?: Record<string, { before: any; after: any }>;
    createdAt: string;
}

interface Props {
    entries: AuditEntry[];
    loanId: string;
    currentUserId: string;
}

const ACTION_TONE: Record<string, string> = {
    create: 'success',
    update: 'info',
    delete: 'destructive',
    status_change: 'warning',
    assign: 'info',
    convert: 'info',
    send: 'info',
    sign: 'success',
    pay: 'success',
    void: 'destructive',
    refund: 'warning',
    comment: 'secondary',
};

function toneFor(action: string): string {
    return ACTION_TONE[action] ?? 'secondary';
}

function actionLabel(action: string): string {
    return action.replace(/_/g, ' ');
}

function stringifyFragment(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') return value.length > 80 ? value.slice(0, 80) + '…' : value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        const json = JSON.stringify(value);
        return json.length > 80 ? json.slice(0, 80) + '…' : json;
    } catch {
        return '[unserializable]';
    }
}

function DiffTable({ diff }: { diff: NonNullable<AuditEntry['diff']> }) {
    const entries = Object.entries(diff).filter(([, change]) => {
        return change.before !== undefined || change.after !== undefined;
    });
    if (entries.length === 0) return null;
    return (
        <div className="mt-2 overflow-hidden rounded border border-zoru-line dark:border-zoru-line">
            <table className="w-full text-xs">
                <thead className="bg-zoru-surface-2 dark:bg-zoru-ink/50">
                    <tr>
                        <th className="px-2 py-1 text-left font-medium text-zoru-ink">Field</th>
                        <th className="px-2 py-1 text-left font-medium text-zoru-ink">Before</th>
                        <th className="px-2 py-1 text-left font-medium text-zoru-ink">After</th>
                    </tr>
                </thead>
                <tbody>
                    {entries.map(([field, change]) => (
                        <tr key={field} className="border-t border-zoru-line dark:border-zoru-line">
                            <td className="px-2 py-1 align-top font-medium">{field}</td>
                            <td className="px-2 py-1 align-top text-zoru-ink">
                                {stringifyFragment(change.before)}
                            </td>
                            <td className="px-2 py-1 align-top">
                                {stringifyFragment(change.after)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diffSec = Math.round((then - Date.now()) / 1000);
    const abs = Math.abs(diffSec);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    if (abs < 60) return rtf.format(diffSec, 'second');
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
    if (abs < 86_400) return rtf.format(Math.round(diffSec / 3600), 'hour');
    if (abs < 604_800) return rtf.format(Math.round(diffSec / 86_400), 'day');
    return new Date(iso).toLocaleDateString();
}

function absoluteTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

function actorLabel(actorId: string, sessionUserId: string): string {
    if (!actorId) return 'System';
    if (actorId === sessionUserId) return 'You';
    return `User ${actorId.slice(-6)}`;
}

export function LoanActivityClient({ entries, loanId, currentUserId }: Props) {
    const [filter, setFilter] = useState<string>('all');
    const [comment, setComment] = useState('');
    const [isPending, startTransition] = useTransition();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const filteredEntries = entries.filter((e) => {
        if (filter === 'all') return true;
        if (filter === 'payments' && e.action === 'pay') return true;
        if (filter === 'status' && e.action === 'status_change') return true;
        if (filter === 'comments' && e.action === 'comment') return true;
        return false;
    });

    const handleAddComment = () => {
        if (!comment.trim()) return;
        startTransition(async () => {
            try {
                await addManualLogEntry(loanId, comment.trim());
                setComment('');
                toast.success('Log entry added');
            } catch (error: any) {
                toast.error(error.message || 'Failed to add entry');
            }
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <ZoruCardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
                    <ZoruCardTitle>Activity Timeline</ZoruCardTitle>
                    <Select value={filter} onValueChange={setFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter activity" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Activity</SelectItem>
                            <SelectItem value="payments">Payments</SelectItem>
                            <SelectItem value="status">Status Changes</SelectItem>
                            <SelectItem value="comments">Comments & Logs</SelectItem>
                        </SelectContent>
                    </Select>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="mb-6 space-y-3 rounded-lg border border-zoru-line bg-zoru-surface-2 p-4 dark:border-zoru-line dark:bg-zoru-ink/50">
                        <Textarea
                            placeholder="Add a comment or manual log entry..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="min-h-[80px] bg-white dark:bg-zoru-ink"
                        />
                        <div className="flex justify-end">
                            <Button 
                                onClick={handleAddComment} 
                                disabled={isPending || !comment.trim()}
                                size="sm"
                            >
                                {isPending ? 'Adding...' : 'Add Entry'}
                            </Button>
                        </div>
                    </div>

                    {filteredEntries.length === 0 ? (
                        <p className="text-sm text-zoru-ink py-4 text-center">No activity found.</p>
                    ) : (
                        <ol className="relative space-y-4 border-l border-zoru-line pl-4 dark:border-zoru-line mt-6">
                            {filteredEntries.map((entry) => {
                                const tone = toneFor(entry.action);
                                const id = typeof entry._id === 'string' ? entry._id : String(entry._id);
                                return (
                                    <li key={id} className="relative">
                                        <span
                                            className="absolute -left-[21px] top-1.5 inline-block size-2.5 rounded-full border border-white bg-zoru-surface-2 dark:border-zoru-line"
                                            aria-hidden
                                        />
                                        <div className="flex flex-wrap items-baseline gap-2 text-sm">
                                            <span className="font-medium">
                                                {actorLabel(String(entry.actorId ?? ''), currentUserId)}
                                            </span>
                                            <Badge variant={tone as any}>
                                                {actionLabel(entry.action)}
                                            </Badge>
                                            <span className="text-zoru-ink">{entry.entityKind}</span>
                                            <time
                                                className="ml-auto text-xs text-zoru-ink"
                                                title={isMounted ? absoluteTime(entry.createdAt) : undefined}
                                            >
                                                {isMounted ? relativeTime(entry.createdAt) : entry.createdAt.slice(0, 10)}
                                            </time>
                                        </div>
                                        {entry.reason ? (
                                            <p className="mt-1 text-xs text-zoru-ink">{entry.reason}</p>
                                        ) : null}
                                        {entry.diff ? <DiffTable diff={entry.diff} /> : null}
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </ZoruCardContent>
            </Card>
        </div>
    );
}
