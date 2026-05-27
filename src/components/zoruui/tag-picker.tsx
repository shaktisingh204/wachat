"use client";

import * as React from "react";
import {
    Check,
    ChevronsUpDown,
    LoaderCircle,
    MoreHorizontal,
    Pencil,
    Plus,
    Trash2,
    X,
} from "lucide-react";

import { cn } from "./lib/cn";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, ZoruPopoverContent, ZoruPopoverTrigger } from "./popover";
import {
    DropdownMenu,
    ZoruDropdownMenuContent,
    ZoruDropdownMenuItem,
    ZoruDropdownMenuTrigger,
} from "./dropdown-menu";

export interface ZoruTagPickerTag {
    _id: string;
    name: string;
    color: string;
}

export interface ZoruTagPickerProps {
    /** All tags in scope (typically the current user's tag library). */
    tags: ZoruTagPickerTag[];
    /** Currently selected tag IDs. */
    selectedTagIds: string[];
    /** Fired when the user toggles selection. */
    onSelectionChange: (next: string[]) => void;
    /**
     * Persist a new tag. Resolve with the updated tag list (incl. the new
     * tag) so the picker can refresh + auto-select. Reject / throw to keep
     * the inline form open with the user's draft.
     */
    onCreate?: (input: { name: string; color: string }) => Promise<ZoruTagPickerTag[]>;
    /** Persist a rename / recolor. Same return contract as `onCreate`. */
    onUpdate?: (id: string, patch: { name?: string; color?: string }) => Promise<ZoruTagPickerTag[]>;
    /** Delete a tag. Same return contract as `onCreate`. */
    onDelete?: (id: string) => Promise<ZoruTagPickerTag[]>;
    /** Push refreshed tags up to the parent after every successful mutation. */
    onTagsChange?: (next: ZoruTagPickerTag[]) => void;
    placeholder?: string;
    className?: string;
    /** Render error toasts / inline messages — keeps the primitive UI-agnostic. */
    onError?: (message: string) => void;
    /** Hide inline create + per-tag actions (read-only multi-select). */
    readOnly?: boolean;
}

const DEFAULT_COLOR = "#6366F1";

/**
 * Multi-select tag dropdown with inline create + per-row three-dot menu
 * (rename inline, delete). UI-only — the consumer wires persistence via
 * `onCreate` / `onUpdate` / `onDelete`. Pair with `tag-picker.tsx` in
 * `@/components/zoruui-domain` for user-tag persistence.
 */
export function ZoruTagPicker({
    tags,
    selectedTagIds,
    onSelectionChange,
    onCreate,
    onUpdate,
    onDelete,
    onTagsChange,
    onError,
    placeholder = "Select tags…",
    className,
    readOnly,
}: ZoruTagPickerProps) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [createOpen, setCreateOpen] = React.useState(false);
    const [createName, setCreateName] = React.useState("");
    const [createColor, setCreateColor] = React.useState(DEFAULT_COLOR);
    const [editId, setEditId] = React.useState<string | null>(null);
    const [editName, setEditName] = React.useState("");
    const [editColor, setEditColor] = React.useState(DEFAULT_COLOR);
    const [pending, startTransition] = React.useTransition();

    const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return tags;
        return tags.filter((t) => t.name.toLowerCase().includes(q));
    }, [tags, query]);

    const toggle = (id: string) => {
        const next = selectedTagIds.includes(id)
            ? selectedTagIds.filter((t) => t !== id)
            : [...selectedTagIds, id];
        onSelectionChange(next);
    };

    const reportError = (msg: string) => {
        if (onError) onError(msg);
        else console.error("[ZoruTagPicker]", msg);
    };

    const handleCreate = () => {
        if (!onCreate) return;
        const name = createName.trim();
        if (!name) return;
        startTransition(async () => {
            try {
                const next = await onCreate({ name, color: createColor });
                onTagsChange?.(next);
                const created =
                    next.find((t) => t.name === name && !tags.some((p) => p._id === t._id)) ??
                    next[next.length - 1];
                if (created) onSelectionChange([...selectedTagIds, created._id]);
                setCreateName("");
                setCreateColor(DEFAULT_COLOR);
                setCreateOpen(false);
            } catch (e: unknown) {
                reportError(e instanceof Error ? e.message : "Failed to create tag");
            }
        });
    };

    const beginEdit = (tag: ZoruTagPickerTag) => {
        setEditId(tag._id);
        setEditName(tag.name);
        setEditColor(tag.color);
    };

    const handleSaveEdit = () => {
        if (!onUpdate || !editId) return;
        const name = editName.trim();
        if (!name) return;
        startTransition(async () => {
            try {
                const next = await onUpdate(editId, { name, color: editColor });
                onTagsChange?.(next);
                setEditId(null);
            } catch (e: unknown) {
                reportError(e instanceof Error ? e.message : "Failed to update tag");
            }
        });
    };

    const handleDelete = (tag: ZoruTagPickerTag) => {
        if (!onDelete) return;
        if (!confirm(`Delete tag "${tag.name}"? Items using it will lose this tag.`)) return;
        startTransition(async () => {
            try {
                const next = await onDelete(tag._id);
                onTagsChange?.(next);
                if (selectedTagIds.includes(tag._id)) {
                    onSelectionChange(selectedTagIds.filter((id) => id !== tag._id));
                }
                if (editId === tag._id) setEditId(null);
            } catch (e: unknown) {
                reportError(e instanceof Error ? e.message : "Failed to delete tag");
            }
        });
    };

    const selectedLabels = selectedTagIds
        .map((id) => tags.find((t) => t._id === id))
        .filter((t): t is ZoruTagPickerTag => !!t);

    const showCreate = !readOnly && !!onCreate;
    const showRowActions = !readOnly && (!!onUpdate || !!onDelete);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <ZoruPopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "flex h-9 w-full items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3 text-[13px] text-zoru-ink",
                        "hover:border-zoru-line-strong focus:outline-none focus:border-zoru-ink",
                        className,
                    )}
                >
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1 truncate text-left">
                        {selectedLabels.length === 0 ? (
                            <span className="text-zoru-ink-subtle">{placeholder}</span>
                        ) : (
                            selectedLabels.map((tag) => (
                                <span
                                    key={tag._id}
                                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                                    style={{
                                        backgroundColor: `${tag.color}22`,
                                        color: tag.color,
                                        border: `1px solid ${tag.color}55`,
                                    }}
                                >
                                    {tag.name}
                                </span>
                            ))
                        )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-zoru-ink-muted" />
                </button>
            </ZoruPopoverTrigger>
            <ZoruPopoverContent
                className="w-[--radix-popover-trigger-width] min-w-[260px] p-0"
                align="start"
            >
                <div className="border-b border-zoru-line p-2">
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search tags…"
                        className="h-8 text-[12px]"
                        autoFocus
                    />
                </div>

                <div className="max-h-72 overflow-y-auto py-1">
                    {filtered.length === 0 && !createOpen && (
                        <p className="px-3 py-4 text-center text-[12px] text-zoru-ink-subtle">
                            {query ? `No tags match "${query}"` : "No tags yet."}
                        </p>
                    )}
                    {filtered.map((tag) => {
                        const isSelected = selectedTagIds.includes(tag._id);
                        if (editId === tag._id && !readOnly && onUpdate) {
                            return (
                                <div key={tag._id} className="flex items-center gap-2 px-2 py-1.5">
                                    <Input
                                        type="color"
                                        value={editColor}
                                        onChange={(e) => setEditColor(e.target.value)}
                                        className="h-7 w-9 shrink-0 p-0.5"
                                    />
                                    <Input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleSaveEdit();
                                            if (e.key === "Escape") setEditId(null);
                                        }}
                                        className="h-7 text-[12px]"
                                        autoFocus
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="h-7 px-2 text-[11px]"
                                        disabled={pending || !editName.trim()}
                                        onClick={handleSaveEdit}
                                    >
                                        Save
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="h-7 w-7"
                                        onClick={() => setEditId(null)}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            );
                        }
                        return (
                            <div
                                key={tag._id}
                                className="group flex items-center gap-2 px-2 py-1.5 hover:bg-zoru-surface-2"
                            >
                                <button
                                    type="button"
                                    onClick={() => toggle(tag._id)}
                                    className="flex flex-1 items-center gap-2 text-left text-[13px] text-zoru-ink"
                                >
                                    <Check
                                        className={cn(
                                            "h-4 w-4 shrink-0",
                                            isSelected ? "opacity-100" : "opacity-0",
                                        )}
                                    />
                                    <span
                                        className="h-3 w-3 shrink-0 rounded-full"
                                        style={{ backgroundColor: tag.color }}
                                    />
                                    <span className="truncate">{tag.name}</span>
                                </button>
                                {showRowActions && (
                                    <DropdownMenu>
                                        <ZoruDropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                aria-label={`Actions for ${tag.name}`}
                                                className="rounded p-1 text-zoru-ink-muted opacity-0 transition-opacity hover:bg-zoru-surface-3 hover:text-zoru-ink group-hover:opacity-100 focus-visible:opacity-100"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <MoreHorizontal className="h-4 w-4" />
                                            </button>
                                        </ZoruDropdownMenuTrigger>
                                        <ZoruDropdownMenuContent align="end" className="w-40">
                                            {onUpdate && (
                                                <ZoruDropdownMenuItem
                                                    onSelect={(e) => {
                                                        e.preventDefault();
                                                        beginEdit(tag);
                                                    }}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                    <span>Edit</span>
                                                </ZoruDropdownMenuItem>
                                            )}
                                            {onDelete && (
                                                <ZoruDropdownMenuItem
                                                    destructive
                                                    onSelect={(e) => {
                                                        e.preventDefault();
                                                        handleDelete(tag);
                                                    }}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    <span>Delete</span>
                                                </ZoruDropdownMenuItem>
                                            )}
                                        </ZoruDropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        );
                    })}
                </div>

                {showCreate && (
                    <div className="border-t border-zoru-line p-2">
                        {createOpen ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    type="color"
                                    value={createColor}
                                    onChange={(e) => setCreateColor(e.target.value)}
                                    className="h-7 w-9 shrink-0 p-0.5"
                                />
                                <Input
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleCreate();
                                        if (e.key === "Escape") {
                                            setCreateOpen(false);
                                            setCreateName("");
                                        }
                                    }}
                                    placeholder="Tag name"
                                    className="h-7 text-[12px]"
                                    autoFocus
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    className="h-7 px-2 text-[11px]"
                                    disabled={pending || !createName.trim()}
                                    onClick={handleCreate}
                                >
                                    {pending ? (
                                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        "Add"
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="h-7 w-7"
                                    onClick={() => {
                                        setCreateOpen(false);
                                        setCreateName("");
                                    }}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    setCreateName(query);
                                    setCreateOpen(true);
                                }}
                                className="flex w-full items-center gap-2 rounded-[var(--zoru-radius-sm)] px-2 py-1.5 text-[12px] font-medium text-zoru-ink hover:bg-zoru-surface-2"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                <span>
                                    Create new tag
                                    {query ? `: "${query}"` : ""}
                                </span>
                            </button>
                        )}
                    </div>
                )}
            </ZoruPopoverContent>
        </Popover>
    );
}

export const TagPicker = ZoruTagPicker;
