import * as React from 'react';
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSelectContent,
  ZoruSelectItem,
  Sheet,
  ZoruSheetContent,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetDescription,
  StatCard,
  EmptyState,
  Skeleton,
  useZoruToast,
  cn,
} from '@/components/zoruui';
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
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
                    <Input
                        placeholder="Search packs..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <ZoruSelectTrigger className="w-[140px]">
                            <ZoruSelectValue placeholder="Type" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">All Types</ZoruSelectItem>
                            <ZoruSelectItem value="regular">Regular</ZoruSelectItem>
                            <ZoruSelectItem value="mask">Mask</ZoruSelectItem>
                            <ZoruSelectItem value="custom_emoji">Custom Emoji</ZoruSelectItem>
                        </ZoruSelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <ZoruSelectTrigger className="w-[160px]">
                            <ZoruSelectValue placeholder="Sort" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="date-desc">Newest First</ZoruSelectItem>
                            <ZoruSelectItem value="date-asc">Oldest First</ZoruSelectItem>
                            <ZoruSelectItem value="name-asc">Name (A-Z)</ZoruSelectItem>
                            <ZoruSelectItem value="name-desc">Name (Z-A)</ZoruSelectItem>
                            <ZoruSelectItem value="count-desc">Most Stickers</ZoruSelectItem>
                            <ZoruSelectItem value="count-asc">Least Stickers</ZoruSelectItem>
                        </ZoruSelectContent>
                    </Select>
                </div>
            </div>

            {filteredAndSorted.length === 0 ? (
                <EmptyState
                    icon={<Search className="h-6 w-6 text-zoru-ink-muted" />}
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
                                'group flex flex-col items-stretch gap-2 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-3 text-left transition-colors hover:border-zoru-ink/40',
                                s.archived && 'opacity-60',
                            )}
                        >
                            <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-[var(--zoru-radius)] bg-zoru-surface">
                                {s.thumbnailUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={s.thumbnailUrl}
                                        alt={s.title}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                    />
                                ) : (
                                    <StickerIcon className="h-10 w-10 text-zoru-ink-muted" />
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-[14px] font-medium text-zoru-ink">
                                        {s.title || s.name}
                                    </div>
                                    <div className="truncate text-[11.5px] text-zoru-ink-muted">
                                        {s.name}
                                    </div>
                                </div>
                                <Badge variant="ghost" className="shrink-0 capitalize">
                                    {s.stickerType.replace('_', ' ')}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between text-[12px] text-zoru-ink-muted">
                                <span>
                                    {s.stickerCount} {s.stickerCount === 1 ? 'sticker' : 'stickers'}
                                </span>
                                {s.archived && <span className="text-amber-600">Archived</span>}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

