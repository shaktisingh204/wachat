'use client';

/**
 * File tile for the grid view — image thumbnail (or a colourful type glyph),
 * name, size, a member stack and an actions menu. Clicking the tile opens the
 * details panel.
 */
import * as React from 'react';

import { fileTypeBadge, formatBytes, isImageNode, tint } from './lib';
import { SabMemberStack } from './sab-member-stack';
import type { SabfilesNode, SabFileMember } from './types';

export interface SabFileGridCardProps {
    node: SabfilesNode;
    members?: SabFileMember[];
    selected?: boolean;
    onOpen: () => void;
    /** Actions menu rendered in the bottom-right (a 20ui <Menu>). */
    menu?: React.ReactNode;
}

export function SabFileGridCard({
    node,
    members,
    selected,
    onOpen,
    menu,
}: SabFileGridCardProps): React.JSX.Element {
    const badge = fileTypeBadge(node);
    return (
        <div className="group relative">
            <button
                type="button"
                onClick={onOpen}
                aria-pressed={selected}
                className={[
                    'flex w-full flex-col gap-2 rounded-[var(--st-radius-lg)] border p-2.5 text-left transition-all',
                    'hover:-translate-y-0.5 hover:shadow-[var(--st-shadow-md)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent-ring)]',
                    selected
                        ? 'border-[var(--st-accent)] ring-2 ring-[var(--st-accent-ring)]'
                        : 'border-[var(--st-border)] bg-[var(--st-bg)]',
                ].join(' ')}
            >
                <span className="relative flex h-28 w-full items-center justify-center overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]">
                    {isImageNode(node) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={node.url} alt={node.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                        <span
                            className="flex h-12 w-12 items-center justify-center rounded-[var(--st-radius)]"
                            style={{ background: tint(badge.color, 16), color: badge.color }}
                            aria-hidden="true"
                        >
                            <badge.Icon size={26} />
                        </span>
                    )}
                </span>
                <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--st-text)]">{node.name}</div>
                    <div className="text-xs text-[var(--st-text-tertiary)]">{formatBytes(node.size)}</div>
                </div>
            </button>
            <div className="flex items-center justify-between px-1 pt-1">
                <SabMemberStack members={members} size="xs" max={3} />
                {menu ? (
                    <div className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        {menu}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
