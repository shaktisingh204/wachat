'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';

export interface SubmissionsFiltersProps {
    initialQuery: string;
    initialStatus: 'all' | 'new' | 'processed' | 'spam' | 'archived';
    initialFrom: string;
    initialTo: string;
}

const STATUS_OPTIONS: Array<{ value: SubmissionsFiltersProps['initialStatus']; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'new', label: 'New' },
    { value: 'processed', label: 'Processed' },
    { value: 'spam', label: 'Spam' },
    { value: 'archived', label: 'Archived' },
];

export function SubmissionsFilters({
    initialQuery,
    initialStatus,
    initialFrom,
    initialTo,
}: SubmissionsFiltersProps) {
    const router = useRouter();
    const pathname = usePathname();
    const sp = useSearchParams();

    const [query, setQuery] = React.useState(initialQuery);
    const [status, setStatus] = React.useState<SubmissionsFiltersProps['initialStatus']>(
        initialStatus,
    );
    const [from, setFrom] = React.useState(initialFrom);
    const [to, setTo] = React.useState(initialTo);

    const writeUrl = React.useCallback(
        (next: Partial<{ q: string; status: string; from: string; to: string }>) => {
            const params = new URLSearchParams(sp?.toString() ?? '');
            const apply = (k: string, v: string | undefined) => {
                if (v && v.length > 0 && v !== 'all') params.set(k, v);
                else params.delete(k);
            };
            if ('q' in next) apply('q', next.q);
            if ('status' in next) apply('status', next.status);
            if ('from' in next) apply('from', next.from);
            if ('to' in next) apply('to', next.to);
            params.set('page', '1');
            const qs = params.toString();
            router.push(qs ? `${pathname}?${qs}` : pathname);
        },
        [pathname, router, sp],
    );

    React.useEffect(() => {
        if (query === initialQuery) return;
        const t = setTimeout(() => writeUrl({ q: query.trim() }), 300);
        return () => clearTimeout(t);
    }, [query, initialQuery, writeUrl]);

    const hasActive =
        query.trim() !== '' || status !== 'all' || from !== '' || to !== '';

    const clearAll = () => {
        setQuery('');
        setStatus('all');
        setFrom('');
        setTo('');
        writeUrl({ q: '', status: 'all', from: '', to: '' });
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by email, name, source, IP…"
                    className="h-9 pl-9 text-[13px]"
                />
            </div>

            <Select
                value={status}
                onValueChange={(v) => {
                    const next = v as SubmissionsFiltersProps['initialStatus'];
                    setStatus(next);
                    writeUrl({ status: next });
                }}
            >
                <SelectTrigger className="h-9 w-[160px] text-[13px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Input
                type="date"
                value={from}
                onChange={(e) => {
                    setFrom(e.target.value);
                    writeUrl({ from: e.target.value });
                }}
                className="h-9 w-[150px] text-[13px]"
                aria-label="From date"
            />
            <Input
                type="date"
                value={to}
                onChange={(e) => {
                    setTo(e.target.value);
                    writeUrl({ to: e.target.value });
                }}
                className="h-9 w-[150px] text-[13px]"
                aria-label="To date"
            />

            {hasActive ? (
                <Button variant="ghost" size="sm" onClick={clearAll}>
                    <X className="h-3.5 w-3.5" /> Clear
                </Button>
            ) : null}
        </div>
    );
}
