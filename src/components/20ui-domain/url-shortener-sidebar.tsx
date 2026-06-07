'use client';

import {
  Button,
  IconButton,
  Input,
  Separator,
  EmptyState,
  cn,
  useToast,
} from '@/components/sabcrm/20ui';
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
  X,
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
  { value: 'alpha', label: 'Alias A-Z' },
];

// Shared visual recipe for a left-aligned filter row rendered as a ghost Button.
const ROW_BASE =
  'w-[calc(100%-1rem)] mx-2 justify-start gap-2 px-3 text-[12.5px] font-normal';
const rowState = (active: boolean) =>
  active
    ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)]'
    : 'text-[var(--st-text-secondary)]';

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
  const { toast } = useToast();

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
        toast({ title: 'Collection created', tone: 'success' });
      } else {
        toast({ title: result.error ?? 'Failed', tone: 'danger' });
      }
    });
  };

  const handleDelete = (id: string) => {
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
        <Input
          placeholder="Search links..."
          iconLeft={Search}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search links"
        />
      </div>

      {/* Status */}
      <div className="space-y-1.5">
        <div className="px-3 text-[11px] uppercase tracking-wider text-[var(--st-text-tertiary)]">
          Status
        </div>
        <nav className="flex flex-col gap-0.5">
          {STATUS_OPTIONS.map((opt) => {
            const active = statusFilter === opt.value;
            return (
              <Button
                key={opt.value}
                variant="ghost"
                size="sm"
                block
                onClick={() => onStatusChange(opt.value)}
                aria-pressed={active}
                className={cn(ROW_BASE, rowState(active))}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'inline-block h-1.5 w-1.5 rounded-full',
                    opt.value === 'all' && 'bg-[var(--st-text-tertiary)]',
                    opt.value === 'active' && 'bg-[var(--st-status-ok)]',
                    opt.value === 'expiring-soon' && 'bg-[var(--st-warn)]',
                    opt.value === 'expired' && 'bg-[var(--st-danger)]',
                  )}
                />
                {opt.label}
              </Button>
            );
          })}
        </nav>
      </div>

      <Separator />

      {/* Sort */}
      <div className="space-y-1.5">
        <div className="px-3 text-[11px] uppercase tracking-wider text-[var(--st-text-tertiary)]">
          Sort by
        </div>
        <nav className="flex flex-col gap-0.5">
          {SORT_OPTIONS.map((opt) => {
            const active = sortKey === opt.value;
            return (
              <Button
                key={opt.value}
                variant="ghost"
                size="sm"
                block
                onClick={() => onSortChange(opt.value)}
                aria-pressed={active}
                className={cn(ROW_BASE, rowState(active))}
              >
                {opt.label}
              </Button>
            );
          })}
        </nav>
      </div>

      {/* Tags */}
      {userTags.length > 0 ? (
        <>
          <Separator />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-3">
              <span className="text-[11px] uppercase tracking-wider text-[var(--st-text-tertiary)]">
                Tags
              </span>
              {filterTagIds.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFilterTagsChange([])}
                  className="h-auto px-1 py-0 text-[10.5px] font-normal text-[var(--st-text-secondary)]"
                >
                  Clear
                </Button>
              ) : null}
            </div>
            <nav className="flex flex-col gap-0.5">
              {userTags.map((tag) => {
                const active = filterTagIds.includes(tag._id);
                return (
                  <Button
                    key={tag._id}
                    variant="ghost"
                    size="sm"
                    block
                    onClick={() => toggleTag(tag._id)}
                    aria-pressed={active}
                    className={cn(ROW_BASE, rowState(active))}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="truncate flex-1 text-left">{tag.name}</span>
                    {active ? (
                      <TagIcon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                    ) : null}
                  </Button>
                );
              })}
            </nav>
          </div>
        </>
      ) : null}

      <Separator />

      {/* Collections */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-3">
          <span className="text-[11px] uppercase tracking-wider text-[var(--st-text-tertiary)]">
            Collections
          </span>
          <IconButton
            icon={Plus}
            label="New collection"
            variant="ghost"
            size="sm"
            onClick={() => setAdding((v) => !v)}
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          block
          onClick={() => onSelectCollection(null)}
          aria-pressed={selectedCollectionId === null}
          className={cn(ROW_BASE, rowState(selectedCollectionId === null))}
        >
          <Folder className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span className="truncate flex-1 text-left">All Links</span>
        </Button>

        {adding ? (
          <div className="mx-2 p-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] space-y-2">
            <Input
              inputSize="sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name"
              aria-label="Collection name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setAdding(false);
              }}
              autoFocus
            />
            <div className="flex flex-wrap gap-1">
              {PALETTE.map((c) => (
                <Button
                  key={c}
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewColor(c)}
                  aria-label={`Use color ${c}`}
                  aria-pressed={newColor === c}
                  className={cn(
                    'h-4 w-4 min-w-0 p-0 rounded-full border-2',
                    newColor === c ? 'border-[var(--st-text)] scale-110' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="primary"
                onClick={handleCreate}
                disabled={isPending || !newName.trim()}
                block
              >
                {isPending ? (
                  <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  'Add'
                )}
              </Button>
              <IconButton
                icon={X}
                label="Cancel"
                variant="ghost"
                size="sm"
                onClick={() => setAdding(false)}
              />
            </div>
          </div>
        ) : null}

        {collections.map((col) => (
          <div
            key={col._id}
            className={cn(
              'group flex items-center rounded-[var(--st-radius)] mx-2',
              selectedCollectionId === col._id && 'bg-[var(--st-bg-muted)]',
            )}
          >
            <Button
              variant="ghost"
              size="sm"
              block
              onClick={() => onSelectCollection(col._id)}
              aria-pressed={selectedCollectionId === col._id}
              className={cn(
                'mx-0 justify-start gap-2 px-3 text-[12.5px] font-normal',
                selectedCollectionId === col._id
                  ? 'bg-transparent text-[var(--st-text)]'
                  : 'text-[var(--st-text-secondary)]',
              )}
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: col.color }}
              />
              <span className="truncate flex-1 text-left">{col.name}</span>
            </Button>
            <IconButton
              icon={Trash2}
              label={`Delete collection ${col.name}`}
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(col._id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--st-danger)]"
            />
          </div>
        ))}

        {collections.length === 0 && !adding ? (
          <EmptyState
            size="sm"
            icon={FolderX}
            title="No collections yet"
          />
        ) : null}
      </div>

      {hasFilters ? (
        <>
          <Separator />
          <div className="px-2">
            <Button
              variant="ghost"
              size="sm"
              block
              onClick={clearAll}
              iconLeft={Filter}
              className="justify-start"
            >
              Reset filters
            </Button>
          </div>
        </>
      ) : null}
    </aside>
  );
}
