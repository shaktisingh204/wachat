'use client';

import {
  Button,
  Input,
  Label,
  Separator,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import { useEffect, useState, useTransition } from 'react';
import {
  Folder,
  Plus,
  Trash2,
  LoaderCircle,
  FolderX,
  Search,
  Filter,
  Tag as TagIcon,
} from 'lucide-react';
import {
  createCollection,
  deleteCollection,
  getCollections,
  type UrlCollectionDoc,
} from '@/app/actions/url-collections.actions';
import type { Tag } from '@/lib/definitions';

const PALETTE = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#64748b'];

export type SortKey = 'newest' | 'oldest' | 'most-clicks' | 'least-clicks' | 'alpha';
export type StatusKey = 'all' | 'active' | 'expired' | 'expiring-soon';

const STATUS_OPTIONS: Array<{ value: StatusKey; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'expiring-soon', label: 'Expiring soon' },
  { value: 'expired', label: 'Expired' },
];

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'most-clicks', label: 'Most clicks' },
  { value: 'least-clicks', label: 'Least clicks' },
  { value: 'alpha', label: 'Alias A–Z' },
];

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: StatusKey;
  onStatusChange: (v: StatusKey) => void;
  sortKey: SortKey;
  onSortChange: (v: SortKey) => void;
  userTags: Tag[];
  filterTagIds: string[];
  onFilterTagsChange: (ids: string[]) => void;
  selectedCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
}

export function UrlShortenerSidebar({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sortKey,
  onSortChange,
  userTags,
  filterTagIds,
  onFilterTagsChange,
  selectedCollectionId,
  onSelectCollection,
}: Props) {
  const [collections, setCollections] = useState<UrlCollectionDoc[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();

  const load = () => {
    startTransition(async () => {
      const data = await getCollections();
      setCollections(data);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = () => {
    if (!newName.trim()) return;
    startTransition(async () => {
      const result = await createCollection(newName, newColor);
      if (result.success) {
        setNewName('');
        setAdding(false);
        load();
        toast({ title: 'Collection created' });
      } else {
        toast({ title: result.error ?? 'Failed', variant: 'destructive' });
      }
    });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const result = await deleteCollection(id);
      if (result.success) {
        if (selectedCollectionId === id) onSelectCollection(null);
        load();
      }
    });
  };

  const toggleTag = (id: string) => {
    if (filterTagIds.includes(id)) {
      onFilterTagsChange(filterTagIds.filter((t) => t !== id));
    } else {
      onFilterTagsChange([...filterTagIds, id]);
    }
  };

  const clearAll = () => {
    onSearchChange('');
    onStatusChange('all');
    onSortChange('newest');
    onFilterTagsChange([]);
    onSelectCollection(null);
  };

  const hasFilters =
    !!search ||
    statusFilter !== 'all' ||
    sortKey !== 'newest' ||
    filterTagIds.length > 0 ||
    selectedCollectionId !== null;

  return (
    <aside className="w-full lg:w-60 flex-shrink-0 flex flex-col gap-4">
      {/* Search */}
      <div className="px-1">
        <ZoruInput
          placeholder="Search links..."
          leadingSlot={<Search />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="text-[12.5px]"
        />
      </div>

      {/* Status */}
      <div className="space-y-1.5">
        <div className="px-3 text-[11px] uppercase tracking-wider text-zoru-ink-muted/60">
          Status
        </div>
        <nav className="flex flex-col gap-0.5">
          {STATUS_OPTIONS.map((opt) => {
            const active = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onStatusChange(opt.value)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-[12.5px] rounded-md mx-2 transition-colors text-left',
                  active
                    ? 'bg-zoru-surface-2 text-zoru-ink'
                    : 'text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink',
                )}
              >
                <span
                  className={cn(
                    'inline-block h-1.5 w-1.5 rounded-full',
                    opt.value === 'all' && 'bg-zoru-ink-muted/40',
                    opt.value === 'active' && 'bg-zoru-success',
                    opt.value === 'expiring-soon' && 'bg-zoru-warning',
                    opt.value === 'expired' && 'bg-zoru-danger',
                  )}
                />
                {opt.label}
              </button>
            );
          })}
        </nav>
      </div>

      <ZoruSeparator />

      {/* Sort */}
      <div className="space-y-1.5">
        <div className="px-3 text-[11px] uppercase tracking-wider text-zoru-ink-muted/60">
          Sort by
        </div>
        <nav className="flex flex-col gap-0.5">
          {SORT_OPTIONS.map((opt) => {
            const active = sortKey === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSortChange(opt.value)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-[12.5px] rounded-md mx-2 transition-colors text-left',
                  active
                    ? 'bg-zoru-surface-2 text-zoru-ink'
                    : 'text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink',
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tags */}
      {userTags.length > 0 ? (
        <>
          <ZoruSeparator />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-3">
              <span className="text-[11px] uppercase tracking-wider text-zoru-ink-muted/60">
                Tags
              </span>
              {filterTagIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onFilterTagsChange([])}
                  className="text-[10.5px] text-zoru-ink-muted hover:text-zoru-ink"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <nav className="flex flex-col gap-0.5">
              {userTags.map((tag) => {
                const active = filterTagIds.includes(tag._id);
                return (
                  <button
                    key={tag._id}
                    type="button"
                    onClick={() => toggleTag(tag._id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 text-[12.5px] rounded-md mx-2 transition-colors text-left',
                      active
                        ? 'bg-zoru-surface-2 text-zoru-ink'
                        : 'text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink',
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="truncate flex-1">{tag.name}</span>
                    {active ? <TagIcon className="h-3 w-3 flex-shrink-0" /> : null}
                  </button>
                );
              })}
            </nav>
          </div>
        </>
      ) : null}

      <ZoruSeparator />

      {/* Collections */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-3">
          <span className="text-[11px] uppercase tracking-wider text-zoru-ink-muted/60">
            Collections
          </span>
          <ZoruButton
            variant="ghost"
            size="icon-sm"
            onClick={() => setAdding((v) => !v)}
            title="New collection"
          >
            <Plus className="h-3.5 w-3.5" />
          </ZoruButton>
        </div>

        <button
          type="button"
          onClick={() => onSelectCollection(null)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-[12.5px] rounded-md mx-2 transition-colors text-left w-[calc(100%-1rem)]',
            selectedCollectionId === null
              ? 'bg-zoru-surface-2 text-zoru-ink'
              : 'text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink',
          )}
        >
          <Folder className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate flex-1 text-left">All Links</span>
        </button>

        {adding ? (
          <div className="mx-2 p-2 rounded-md border border-zoru-line bg-zoru-surface-2 space-y-2">
            <ZoruInput
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name"
              className="h-7 text-[12px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setAdding(false);
              }}
              autoFocus
            />
            <div className="flex flex-wrap gap-1">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={cn(
                    'h-4 w-4 rounded-full border-2 transition-transform',
                    newColor === c ? 'border-zoru-ink scale-110' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-1">
              <ZoruButton
                size="sm"
                onClick={handleCreate}
                disabled={isPending || !newName.trim()}
                className="flex-1"
              >
                {isPending ? <LoaderCircle className="h-3 w-3 animate-spin" /> : 'Add'}
              </ZoruButton>
              <ZoruButton size="sm" variant="ghost" onClick={() => setAdding(false)}>
                ✕
              </ZoruButton>
            </div>
          </div>
        ) : null}

        {collections.map((col) => (
          <button
            key={col._id}
            type="button"
            onClick={() => onSelectCollection(col._id)}
            className={cn(
              'group flex items-center gap-2 px-3 py-1.5 text-[12.5px] rounded-md mx-2 transition-colors text-left w-[calc(100%-1rem)]',
              selectedCollectionId === col._id
                ? 'bg-zoru-surface-2 text-zoru-ink'
                : 'text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink',
            )}
          >
            <span
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: col.color }}
            />
            <span className="truncate flex-1 text-left">{col.name}</span>
            <span
              onClick={(e) => handleDelete(col._id, e)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-zoru-danger-ink hover:text-zoru-danger p-0.5 rounded"
              role="button"
              title="Delete collection"
            >
              <Trash2 className="h-3 w-3" />
            </span>
          </button>
        ))}

        {collections.length === 0 && !adding ? (
          <div className="px-3 py-4 text-center">
            <FolderX className="h-5 w-5 mx-auto text-zoru-ink-muted/40 mb-1" />
            <p className="text-[11px] text-zoru-ink-muted/60">No collections yet</p>
          </div>
        ) : null}
      </div>

      {hasFilters ? (
        <>
          <ZoruSeparator />
          <div className="px-2">
            <ZoruButton variant="ghost" size="sm" onClick={clearAll} className="w-full justify-start">
              <Filter className="h-3.5 w-3.5" />
              Reset filters
            </ZoruButton>
          </div>
        </>
      ) : null}
    </aside>
  );
}
