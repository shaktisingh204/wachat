'use client';

/**
 * The "Files" list view — Document Name (coloured type chip + name + status
 * badges) · date · size · members · actions. Data-driven and reused by the main
 * browser and every secondary SabFiles page (Recent / Starred / Shared / Trash).
 */
import * as React from 'react';
import Link from 'next/link';

import { Badge, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';

import { fileTypeBadge, formatBytes, formatDateLong, isImageNode, tint } from './lib';
import { SabMemberStack } from './sab-member-stack';
import type { SabfilesNode, SabFileMember } from './types';

export interface SabFileTableProps {
    nodes: SabfilesNode[];
    membersByNode?: Record<string, SabFileMember[]>;
    selectedId?: string | null;
    showMembers?: boolean;
    /** Column header for the date column. Defaults to "Last edit". */
    dateLabel?: string;
    /** Which node timestamp the date column reads. Defaults to `updatedAt`. */
    dateField?: 'updatedAt' | 'createdAt' | 'trashedAt';
    /** Click handler for a file row / name (e.g. open the details panel). */
    onOpen?: (node: SabfilesNode) => void;
    /** Trailing actions cell (a 20ui <Menu> or inline IconButtons). */
    renderActions?: (node: SabfilesNode) => React.ReactNode;
    /** When set, folder rows become links to this href. */
    hrefForFolder?: (node: SabfilesNode) => string;
}

function FileTypeChip({ node }: { node: SabfilesNode }): React.JSX.Element {
    const badge = fileTypeBadge(node);
    if (isImageNode(node)) {
        return (
            <span className="flex h-9 w-9 shrink-0 overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={node.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </span>
        );
    }
    return (
        <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)]"
            style={{ background: tint(badge.color, 14), color: badge.color }}
            aria-hidden="true"
        >
            <badge.Icon size={18} />
        </span>
    );
}

function SabFileTableRow({
    node,
    members,
    selected,
    showMembers,
    dateField,
    onOpen,
    actions,
    folderHref,
}: {
    node: SabfilesNode;
    members?: SabFileMember[];
    selected?: boolean;
    showMembers?: boolean;
    dateField: 'updatedAt' | 'createdAt' | 'trashedAt';
    onOpen?: (node: SabfilesNode) => void;
    actions?: React.ReactNode;
    folderHref?: string;
}): React.JSX.Element {
    const isFolder = node.type === 'folder';
    const dateValue = node[dateField] ?? node.updatedAt;

    const name =
        isFolder && folderHref ? (
            <Link
                href={folderHref}
                className="truncate font-medium text-[var(--st-text)] hover:underline"
            >
                {node.name}
            </Link>
        ) : onOpen ? (
            <button
                type="button"
                onClick={() => onOpen(node)}
                className="truncate text-left font-medium text-[var(--st-text)] hover:underline"
            >
                {node.name}
            </button>
        ) : (
            <span className="truncate font-medium text-[var(--st-text)]">{node.name}</span>
        );

    return (
        <Tr selected={selected}>
            <Td>
                <div className="flex items-center gap-3">
                    <FileTypeChip node={node} />
                    <div className="flex min-w-0 items-center gap-2">
                        {name}
                        {node.starred ? (
                            <Badge tone="warning" kind="soft" dot>
                                Starred
                            </Badge>
                        ) : null}
                        {node.shareToken ? (
                            <Badge tone="info" kind="soft">
                                Shared
                            </Badge>
                        ) : null}
                    </div>
                </div>
            </Td>
            <Td className="whitespace-nowrap text-[var(--st-text-secondary)]">
                {formatDateLong(dateValue)}
            </Td>
            <Td align="right" className="whitespace-nowrap text-[var(--st-text-secondary)]">
                {isFolder ? '—' : formatBytes(node.size)}
            </Td>
            {showMembers ? (
                <Td>
                    <SabMemberStack members={members} size="sm" max={3} />
                </Td>
            ) : null}
            <Td align="right">{actions}</Td>
        </Tr>
    );
}

export function SabFileTable({
    nodes,
    membersByNode,
    selectedId,
    showMembers = true,
    dateLabel = 'Last edit',
    dateField = 'updatedAt',
    onOpen,
    renderActions,
    hrefForFolder,
}: SabFileTableProps): React.JSX.Element {
    return (
        <Table hover>
            <THead>
                <Tr>
                    <Th>Document name</Th>
                    <Th width={180}>{dateLabel}</Th>
                    <Th align="right" width={120}>
                        File size
                    </Th>
                    {showMembers ? <Th width={120}>Member</Th> : null}
                    <Th align="right" width={64}>
                        <span className="sr-only">Actions</span>
                    </Th>
                </Tr>
            </THead>
            <TBody>
                {nodes.map((node) => (
                    <SabFileTableRow
                        key={node.id}
                        node={node}
                        members={membersByNode?.[node.id]}
                        selected={selectedId === node.id}
                        showMembers={showMembers}
                        dateField={dateField}
                        onOpen={onOpen}
                        actions={renderActions?.(node)}
                        folderHref={hrefForFolder ? hrefForFolder(node) : undefined}
                    />
                ))}
            </TBody>
        </Table>
    );
}
