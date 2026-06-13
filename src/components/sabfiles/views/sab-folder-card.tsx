'use client';

/**
 * Folder tile for the "Folders" grid — a coloured icon chip, the folder name,
 * its recursive "N files" count and "X used" size (from rollups), the modified
 * date, and an optional actions menu. Supports a selected/accent state like the
 * highlighted card in the reference.
 */
import * as React from 'react';
import { Folder } from 'lucide-react';

import { formatBytes, formatDate, tint } from './lib';
import type { SabfilesNode, SabFolderRollup } from './types';

/** Deterministic folder accent so the grid reads as colourful as the reference. */
const FOLDER_COLORS = ['#1f9d55', '#7c3aed', '#e5484d', '#2b6ef2', '#e0701e', '#0f9488', '#c2369b'];
function folderAccent(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return FOLDER_COLORS[hash % FOLDER_COLORS.length]!;
}

export interface SabFolderCardProps {
    node: SabfilesNode;
    rollup?: SabFolderRollup;
    selected?: boolean;
    onOpen: () => void;
    /** Actions menu rendered in the top-right corner (e.g. a 20ui <Menu>). */
    menu?: React.ReactNode;
}

export function SabFolderCard({
    node,
    rollup,
    selected,
    onOpen,
    menu,
}: SabFolderCardProps): React.JSX.Element {
    const accent = folderAccent(node.name);
    const fileCount = rollup?.fileCount;

    return (
        <div className="group relative">
            <button
                type="button"
                onClick={onOpen}
                aria-pressed={selected}
                className={[
                    'flex w-full flex-col gap-4 rounded-[var(--st-radius-lg)] border p-4 text-left transition-all',
                    'hover:-translate-y-0.5 hover:shadow-[var(--st-shadow-md)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent-ring)]',
                    selected
                        ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)] shadow-[var(--st-shadow-sm)]'
                        : 'border-[var(--st-border)] bg-[var(--st-bg)]',
                ].join(' ')}
            >
                <div className="flex items-start gap-3">
                    <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--st-radius)]"
                        style={{ background: tint(accent, 16), color: accent }}
                        aria-hidden="true"
                    >
                        <Folder size={22} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-[var(--st-text)]">
                            {node.name}
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--st-text-secondary)]">
                            {fileCount == null
                                ? 'Folder'
                                : `${fileCount} ${fileCount === 1 ? 'file' : 'files'}`}
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--st-text-tertiary)]">
                    <span>{rollup ? `${formatBytes(rollup.totalBytes)} used` : ''}</span>
                    <span>{formatDate(node.updatedAt)}</span>
                </div>
            </button>
            {menu ? (
                <div className="absolute right-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    {menu}
                </div>
            ) : null}
        </div>
    );
}
