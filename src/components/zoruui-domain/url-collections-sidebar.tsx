'use client';

import { useState, useTransition, useEffect } from 'react';
import {
    Button, Input, cn, useZoruToast
} from '@/components/zoruui';
import { Folder, Plus, Trash2, LoaderCircle, FolderX } from 'lucide-react';
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
    const { toast } = useZoruToast();

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
                toast({ title: 'Collection created', variant: 'success' });
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
                if (selectedCollectionId === id) onSelect(null);
                load();
            }
        });
    };

    return (
        <div className="w-52 flex-shrink-0 border-r border-zoru-border flex flex-col py-3 gap-1">
            <div className="flex items-center justify-between px-3 pb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zoru-ink-muted/60">Collections</span>
                <Button
                    variant="ghost" size="icon-sm"
                    onClick={() => setAdding((v) => !v)}
                    title="New collection"
                >
                    <Plus className="h-3.5 w-3.5" />
                </Button>
            </div>

            <button
                onClick={() => onSelect(null)}
                className={cn(
                    'flex items-center gap-2 px-3 py-1.5 text-[12.5px] rounded-md mx-2 transition-colors',
                    selectedCollectionId === null
                        ? 'bg-zinc-800 text-zoru-ink'
                        : 'text-zoru-ink-muted hover:bg-zinc-900 hover:text-zoru-ink'
                )}
            >
                <Folder className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate flex-1 text-left">All Links</span>
            </button>

            {adding && (
                <div className="mx-2 p-2 rounded-md border border-zoru-border bg-zinc-900 space-y-2">
                    <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Collection name"
                        className="h-7 text-[12px]"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setAdding(false); }}
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
                                    newColor === c ? 'border-white scale-110' : 'border-transparent'
                                )}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                    <div className="flex gap-1">
                        <Button size="xs" onClick={handleCreate} disabled={isPending || !newName.trim()} className="flex-1">
                            {isPending ? <LoaderCircle className="h-3 w-3 animate-spin" /> : 'Add'}
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => setAdding(false)}>&#x2715;</Button>
                    </div>
                </div>
            )}

            {collections.map((col) => (
                <button
                    key={col._id}
                    onClick={() => onSelect(col._id)}
                    className={cn(
                        'group flex items-center gap-2 px-3 py-1.5 text-[12.5px] rounded-md mx-2 transition-colors',
                        selectedCollectionId === col._id
                            ? 'bg-zinc-800 text-zoru-ink'
                            : 'text-zoru-ink-muted hover:bg-zinc-900 hover:text-zoru-ink'
                    )}
                >
                    <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: col.color }}
                    />
                    <span className="truncate flex-1 text-left">{col.name}</span>
                    {linkCount && (
                        <span className="text-[10px] text-zoru-ink-muted/60 flex-shrink-0">
                            {linkCount(col._id)}
                        </span>
                    )}
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

            {collections.length === 0 && !adding && (
                <div className="px-3 py-4 text-center">
                    <FolderX className="h-5 w-5 mx-auto text-zoru-ink-muted/40 mb-1" />
                    <p className="text-[11px] text-zoru-ink-muted/60">No collections yet</p>
                </div>
            )}
        </div>
    );
}
