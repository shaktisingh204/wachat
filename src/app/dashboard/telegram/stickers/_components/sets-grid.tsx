import * as React from 'react';
import { Badge, Button, Card, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, StatCard, EmptyState, Skeleton, useToast, cn } from '@/components/sabcrm/20ui/compat';
import {
  Sticker as StickerIcon,
  Search,
  SlidersHorizontal,
  Plus,
  Image as ImageIcon,
  Layers,
  Smile,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  Replace,
  X,
  Loader2,
  RefreshCw,
  Archive,
} from 'lucide-react';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../../_components/telegram-project-gate';
import type {
    SetRow,
    StickerRow,
    StickerType,
    StickerInputBody,
    MaskPositionDto,
} from '@/lib/rust-client/telegram-stickers';
//  Sets grid
// ---------------------------------------------------------------------------

export function GridSkeleton() {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <Skeleton key={i} className="h-[180px] w-full" />
            ))}
        </div>
    );
}


export function SetsGrid({ sets, onOpen }: { sets: SetRow[]; onOpen: (s: SetRow) => void }) {
    const [search, setSearch] = React.useState('');
    const [typeFilter, setTypeFilter] = React.useState<string>('all');
    const [sortBy, setSortBy] = React.useState<string>('date-desc');

    const filteredAndSorted = React.useMemo(() => {
        let result = sets.filter(s => {
            if (typeFilter !== 'all' && s.stickerType !== typeFilter) return false;
            if (search) {
                const term = search.toLowerCase();
                return s.name.toLowerCase().includes(term) || s.title.toLowerCase().includes(term);
            }
            return true;
        });

        result = result.sort((a, b) => {
            switch (sortBy) {
                case 'name-asc':
                    return a.title.localeCompare(b.title);
                case 'name-desc':
                    return b.title.localeCompare(a.title);
                case 'count-asc':
                    return (a.stickerCount ?? 0) - (b.stickerCount ?? 0);
                case 'count-desc':
                    return (b.stickerCount ?? 0) - (a.stickerCount ?? 0);
                case 'date-asc':
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                case 'date-desc':
                default:
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
        });

        return result;
    }, [sets, search, typeFilter, sortBy]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
                    <Input
                        placeholder="Search packs..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="regular">Regular</SelectItem>
                            <SelectItem value="mask">Mask</SelectItem>
                            <SelectItem value="custom_emoji">Custom Emoji</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="date-desc">Newest First</SelectItem>
                            <SelectItem value="date-asc">Oldest First</SelectItem>
                            <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                            <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                            <SelectItem value="count-desc">Most Stickers</SelectItem>
                            <SelectItem value="count-asc">Least Stickers</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {filteredAndSorted.length === 0 ? (
                <EmptyState
                    icon={<Search className="h-6 w-6 text-[var(--st-text-secondary)]" />}
                    title="No matches found"
                    description="Try adjusting your filters or search term."
                />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredAndSorted.map((s) => (
                        <button
                            key={s._id}
                            type="button"
                            onClick={() => onOpen(s)}
                            className={cn(
                                'group flex flex-col items-stretch gap-2 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3 text-left transition-colors hover:border-[var(--st-text)]/40',
                                s.archived && 'opacity-60',
                            )}
                        >
                            <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]">
                                {s.thumbnailUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={s.thumbnailUrl}
                                        alt={s.title}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                    />
                                ) : (
                                    <StickerIcon className="h-10 w-10 text-[var(--st-text-secondary)]" />
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-[14px] font-medium text-[var(--st-text)]">
                                        {s.title || s.name}
                                    </div>
                                    <div className="truncate text-[11.5px] text-[var(--st-text-secondary)]">
                                        {s.name}
                                    </div>
                                </div>
                                <Badge variant="ghost" className="shrink-0 capitalize">
                                    {s.stickerType.replace('_', ' ')}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between text-[12px] text-[var(--st-text-secondary)]">
                                <span>
                                    {s.stickerCount} {s.stickerCount === 1 ? 'sticker' : 'stickers'}
                                </span>
                                {s.archived && <span className="text-[var(--st-text)]">Archived</span>}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

