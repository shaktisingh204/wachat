'use client';

import { Badge, Card } from '@/components/zoruui';
import {
  formatDistanceToNow } from 'date-fns';
import { BookOpen,
  FolderOpen } from 'lucide-react';

/**
 * <KbCategoryTree> — alternate view of the KB list grouped by category
 * (§1D.1 view switcher).
 *
 * Left sidebar lists every distinct category (plus "Uncategorised");
 * picking one filters the right pane to articles in that bucket. The
 * sidebar shows article counts so users can size the catalogue at a
 * glance.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { KbArticleDoc } from '@/app/actions/crm-knowledge-base.actions';

interface KbCategoryTreeProps {
    articles: KbArticleDoc[];
}

export function KbCategoryTree({ articles }: KbCategoryTreeProps) {
    const grouped = React.useMemo(() => {
        const map = new Map<string, KbArticleDoc[]>();
        for (const a of articles) {
            const key = a.category ? a.category : '__uncategorised__';
            const arr = map.get(key) ?? [];
            arr.push(a);
            map.set(key, arr);
        }
        // Sort entries: alphabetical, uncategorised last.
        return Array.from(map.entries()).sort(([a], [b]) => {
            if (a === '__uncategorised__') return 1;
            if (b === '__uncategorised__') return -1;
            return a.localeCompare(b);
        });
    }, [articles]);

    const [active, setActive] = React.useState<string>(() =>
        grouped.length > 0 ? grouped[0][0] : '',
    );

    React.useEffect(() => {
        if (grouped.length > 0 && !grouped.find(([k]) => k === active)) {
            setActive(grouped[0][0]);
        }
    }, [grouped, active]);

    const items = grouped.find(([k]) => k === active)?.[1] ?? [];

    if (grouped.length === 0) {
        return (
            <Card className="p-6 text-center text-[13px] text-zoru-ink-muted">
                No articles match the current filters.
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
            <Card className="p-2">
                <ul className="flex flex-col">
                    {grouped.map(([key, arr]) => {
                        const label =
                            key === '__uncategorised__' ? 'Uncategorised' : key;
                        const isActive = key === active;
                        return (
                            <li key={key}>
                                <button
                                    type="button"
                                    onClick={() => setActive(key)}
                                    className={[
                                        'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px]',
                                        isActive
                                            ? 'bg-zoru-surface-2 text-zoru-ink'
                                            : 'text-zoru-ink-muted hover:bg-zoru-surface-2/60 hover:text-zoru-ink',
                                    ].join(' ')}
                                >
                                    <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                                        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{label}</span>
                                    </span>
                                    <Badge variant="ghost">{arr.length}</Badge>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </Card>

            <div className="flex flex-col gap-2">
                {items.length === 0 ? (
                    <Card className="p-4 text-center text-[13px] text-zoru-ink-muted">
                        No articles in this category.
                    </Card>
                ) : (
                    items.map((a) => {
                        const id = String(a._id);
                        return (
                            <Card key={id} className="p-3">
                                <Link
                                    href={`/dashboard/crm/tickets/knowledge-base/${id}`}
                                    className="flex flex-col gap-1"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="inline-flex items-center gap-2">
                                            <BookOpen className="h-3.5 w-3.5 text-zoru-ink-muted" />
                                            <span className="text-[14px] font-medium text-zoru-ink hover:underline">
                                                {a.title || 'Untitled'}
                                            </span>
                                        </span>
                                        {a.status ? (
                                            <StatusPill
                                                label={a.status}
                                                tone={statusToTone(a.status)}
                                            />
                                        ) : null}
                                    </div>
                                    {a.body ? (
                                        <p className="line-clamp-2 text-[12.5px] text-zoru-ink-muted">
                                            {a.body}
                                        </p>
                                    ) : null}
                                    <div className="flex items-center gap-3 text-[11.5px] text-zoru-ink-muted">
                                        <span>Views: {a.viewCount ?? 0}</span>
                                        {a.updatedAt ? (
                                            <span>
                                                Updated{' '}
                                                {formatDistanceToNow(new Date(a.updatedAt), {
                                                    addSuffix: true,
                                                })}
                                            </span>
                                        ) : null}
                                    </div>
                                </Link>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default KbCategoryTree;
