'use client';

import {
  ZoruBadge,
  ZoruCheckbox,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  formatDistanceToNow } from 'date-fns';
import {
    BookOpen,
  ChevronDown,
  Edit,
  Eye,
  MoreHorizontal,
  Trash2,
  } from 'lucide-react';

/**
 * <KbTable> — 10-column dense table for the KB list (§1D.1).
 *
 * select · Title (chip) · Category · Status · Visibility · Tags ·
 * Views · Helpful % · Updated · Actions.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { KbArticleDoc } from '@/app/actions/crm-knowledge-base.actions';

const VISIBILITY_VARIANTS: Record<
    string,
    React.ComponentProps<typeof ZoruBadge>['variant']
> = {
    public: 'success',
    portal: 'warning',
    internal: 'ghost',
};

interface KbTableProps {
    articles: KbArticleDoc[];
    loading: boolean;
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (all: boolean) => void;
    onDelete: (id: string) => void;
}

function helpfulPct(a: KbArticleDoc): string {
    const yes = a.helpfulYes ?? 0;
    const no = a.helpfulNo ?? 0;
    const total = yes + no;
    if (total === 0) return '—';
    return `${Math.round((yes / total) * 100)}%`;
}

export function KbTable({
    articles,
    loading,
    selectedIds,
    onToggleOne,
    onToggleAll,
    onDelete,
}: KbTableProps) {
    const allSelected =
        articles.length > 0 && articles.every((a) => selectedIds.has(String(a._id)));
    const someSelected =
        !allSelected && articles.some((a) => selectedIds.has(String(a._id)));

    return (
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
                <ZoruTableHeader>
                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                        <ZoruTableHead className="w-[36px]">
                            <ZoruCheckbox
                                aria-label="Select all articles"
                                checked={
                                    allSelected
                                        ? true
                                        : someSelected
                                        ? 'indeterminate'
                                        : false
                                }
                                onCheckedChange={(c) => onToggleAll(c === true)}
                            />
                        </ZoruTableHead>
                        <ZoruTableHead>Title</ZoruTableHead>
                        <ZoruTableHead>Category</ZoruTableHead>
                        <ZoruTableHead>Status</ZoruTableHead>
                        <ZoruTableHead>Visibility</ZoruTableHead>
                        <ZoruTableHead>Tags</ZoruTableHead>
                        <ZoruTableHead className="text-right">Views</ZoruTableHead>
                        <ZoruTableHead className="text-right">Helpful %</ZoruTableHead>
                        <ZoruTableHead>Updated</ZoruTableHead>
                        <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <ZoruTableRow key={i} className="border-zoru-line">
                                <ZoruTableCell colSpan={10}>
                                    <ZoruSkeleton className="h-10 w-full" />
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ))
                    ) : articles.length === 0 ? (
                        <ZoruTableRow className="border-zoru-line">
                            <ZoruTableCell
                                colSpan={10}
                                className="h-24 text-center text-[13px] text-zoru-ink-muted"
                            >
                                No articles match the current filters.
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : (
                        articles.map((a) => {
                            const id = String(a._id);
                            const isSel = selectedIds.has(id);
                            const visibility = String(a.visibility ?? '').toLowerCase();
                            const tags = Array.isArray(a.tags) ? a.tags : [];
                            return (
                                <ZoruTableRow
                                    key={id}
                                    className={[
                                        'border-zoru-line transition-colors',
                                        isSel ? 'bg-zoru-surface-2/70' : '',
                                    ].join(' ')}
                                >
                                    <ZoruTableCell>
                                        <ZoruCheckbox
                                            aria-label={`Select article ${a.title || id}`}
                                            checked={isSel}
                                            onCheckedChange={() => onToggleOne(id)}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                                                <BookOpen className="h-3.5 w-3.5" />
                                            </span>
                                            <EntityRowLink
                                                href={`/dashboard/crm/tickets/knowledge-base/${id}`}
                                                label={
                                                    <span className="block max-w-[320px] truncate text-[13px]">
                                                        {a.title || 'Untitled'}
                                                    </span>
                                                }
                                                subtitle={
                                                    a.slug ? (
                                                        <span className="block max-w-[320px] truncate font-mono text-[11px]">
                                                            /{a.slug}
                                                        </span>
                                                    ) : undefined
                                                }
                                            />
                                        </div>
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {a.category ? (
                                            <EntityPickerChip
                                                entity="category"
                                                id={a.category}
                                                fallback={a.category}
                                            />
                                        ) : (
                                            '—'
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {a.status ? (
                                            <StatusPill
                                                label={a.status}
                                                tone={statusToTone(a.status)}
                                            />
                                        ) : (
                                            <span className="text-[12px] text-zoru-ink-muted">—</span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {visibility ? (
                                            <ZoruBadge
                                                variant={VISIBILITY_VARIANTS[visibility] ?? 'ghost'}
                                            >
                                                {visibility}
                                            </ZoruBadge>
                                        ) : (
                                            <span className="text-[12px] text-zoru-ink-muted">—</span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {tags.length === 0 ? (
                                            <span className="text-[12px] text-zoru-ink-muted">—</span>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {tags.slice(0, 3).map((t) => (
                                                    <ZoruBadge key={t} variant="ghost">
                                                        {t}
                                                    </ZoruBadge>
                                                ))}
                                                {tags.length > 3 ? (
                                                    <span className="text-[11px] text-zoru-ink-muted">
                                                        +{tags.length - 3}
                                                    </span>
                                                ) : null}
                                            </div>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right text-[12.5px] text-zoru-ink-muted">
                                        <span className="inline-flex items-center gap-1">
                                            <Eye className="h-3 w-3" />
                                            {a.viewCount ?? 0}
                                        </span>
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right text-[12.5px] text-zoru-ink-muted">
                                        {helpfulPct(a)}
                                    </ZoruTableCell>
                                    <ZoruTableCell
                                        className="text-[12.5px] text-zoru-ink-muted"
                                        title={
                                            a.updatedAt
                                                ? new Date(a.updatedAt).toLocaleString()
                                                : ''
                                        }
                                    >
                                        {a.updatedAt
                                            ? formatDistanceToNow(new Date(a.updatedAt), {
                                                  addSuffix: true,
                                              })
                                            : '—'}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <ZoruDropdownMenu>
                                            <ZoruDropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`Actions for ${a.title || id}`}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </ZoruDropdownMenuTrigger>
                                            <ZoruDropdownMenuContent align="end">
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link
                                                        href={`/dashboard/crm/tickets/knowledge-base/${id}`}
                                                    >
                                                        <ChevronDown className="mr-1.5 h-3.5 w-3.5 rotate-[-90deg]" />
                                                        View
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link
                                                        href={`/dashboard/crm/tickets/knowledge-base/${id}/edit`}
                                                    >
                                                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                                                        Edit
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuSeparator />
                                                <ZoruDropdownMenuItem
                                                    onClick={() => onDelete(id)}
                                                    className="text-zoru-danger"
                                                >
                                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                                    Delete
                                                </ZoruDropdownMenuItem>
                                            </ZoruDropdownMenuContent>
                                        </ZoruDropdownMenu>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            );
                        })
                    )}
                </ZoruTableBody>
            </ZoruTable>
        </div>
    );
}

export default KbTable;
