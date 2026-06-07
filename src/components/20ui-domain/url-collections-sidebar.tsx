'use client';

import { useState, useTransition, useEffect } from 'react';
import {
    Button,
    IconButton,
    Input,
    Field,
    EmptyState,
    cn,
    useToast,
} from '@/components/sabcrm/20ui';
import { Folder, Plus, Trash2, FolderX, X } from 'lucide-react';
import {
    getCollections, createCollection, deleteCollection,
    type UrlCollectionDoc
} from '@/app/actions/url-collections.actions';

const PALETTE = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#64748b'];

interface Props {
    selectedCollectionId: string | null;
    onSelect: (id: string | null) => void;
    linkCount?: (id: string) => number;
}

export function UrlCollectionsSidebar({ selectedCollectionId, onSelect, linkCount }: Props) {
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

    useEffect(() => { load(); }, []);

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
                toast({ title: result.error ?? 'Failed to create collection', tone: 'danger' });
            }
        });
    };

    const handleDelete = (id: string) => {
        startTransition(async () => {
            const result = await deleteCollection(id);
            if (result.success) {
                if (selectedCollectionId === id) onSelect(null);
                load();
            } else {
                toast({ title: result.error ?? 'Failed to delete collection', tone: 'danger' });
            }
        });
    };

    const rowClass = (active: boolean) =>
        cn(
            'flex items-center gap-2 px-3 py-1.5 text-[12.5px] rounded-[var(--st-radius)] mx-2 transition-colors text-left',
            active
                ? 'bg-[var(--st-accent-soft)] text-[var(--st-accent)] font-medium'
                : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]'
        );

    return (
        <div className="w-52 flex-shrink-0 border-r border-[var(--st-border)] flex flex-col py-3 gap-1">
            <div className="flex items-center justify-between px-3 pb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--st-text-tertiary)]">Collections</span>
                <IconButton
                    label="New collection"
                    icon={Plus}
                    variant="ghost"
                    size="sm"
                    onClick={() => setAdding((v) => !v)}
                />
            </div>

            <Button
                variant="ghost"
                onClick={() => onSelect(null)}
                aria-pressed={selectedCollectionId === null}
                className={cn(rowClass(selectedCollectionId === null), 'w-auto justify-start')}
            >
                <Folder className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                <span className="truncate flex-1 text-left">All Links</span>
            </Button>

            {adding && (
                <div className="mx-2 p-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] space-y-2">
                    <Field label="Collection name">
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="e.g. Campaign links"
                            inputSize="sm"
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setAdding(false); }}
                            autoFocus
                        />
                    </Field>
                    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Collection color">
                        {PALETTE.map((c) => (
                            <Button
                                key={c}
                                variant="ghost"
                                role="radio"
                                aria-checked={newColor === c}
                                aria-label={`Color ${c}`}
                                onClick={() => setNewColor(c)}
                                className={cn(
                                    'h-4 w-4 min-w-0 p-0 rounded-full border-2 transition-transform',
                                    newColor === c ? 'border-[var(--st-text)] scale-110' : 'border-transparent'
                                )}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                    <div className="flex gap-1">
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleCreate}
                            loading={isPending}
                            disabled={!newName.trim()}
                            block
                        >
                            Add
                        </Button>
                        <IconButton
                            label="Cancel"
                            icon={X}
                            variant="ghost"
                            size="sm"
                            onClick={() => setAdding(false)}
                        />
                    </div>
                </div>
            )}

            {collections.map((col) => {
                const active = selectedCollectionId === col._id;
                return (
                    <div key={col._id} className={cn('group flex items-center', rowClass(active), 'gap-0 px-0 py-0')}>
                        <Button
                            variant="ghost"
                            onClick={() => onSelect(col._id)}
                            aria-pressed={active}
                            className="flex items-center gap-2 flex-1 min-w-0 px-3 py-1.5 justify-start bg-transparent hover:bg-transparent border-0 shadow-none h-auto text-inherit"
                        >
                            <span
                                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: col.color }}
                                aria-hidden="true"
                            />
                            <span className="truncate flex-1 text-left">{col.name}</span>
                            {linkCount && (
                                <span className="text-[10px] text-[var(--st-text-tertiary)] flex-shrink-0">
                                    {linkCount(col._id)}
                                </span>
                            )}
                        </Button>
                        <IconButton
                            label={`Delete collection ${col.name}`}
                            icon={Trash2}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(col._id)}
                            className="mr-1 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--st-danger)]"
                        />
                    </div>
                );
            })}

            {collections.length === 0 && !adding && !isPending && (
                <div className="px-3 py-4">
                    <EmptyState
                        icon={FolderX}
                        size="sm"
                        title="No collections yet"
                        description="Create one to group your links."
                    />
                </div>
            )}
        </div>
    );
}
