'use client';

/**
 * The right-hand Details panel from the reference — preview, name + type,
 * Property (size · owner · created), More Details (last edit · path), the
 * collaborator list, and primary actions. One component, two mounts: an inline
 * `rail` (docked column on wide layouts) or a `sheet` (slide-in on narrow ones).
 */
import * as React from 'react';
import { Download, Pencil, Share2, Trash2, X } from 'lucide-react';

import {
    Avatar,
    Badge,
    Button,
    IconButton,
    ScrollArea,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/sabcrm/20ui';

import { fileTypeBadge, formatBytes, formatDate, isImageNode, tint } from './lib';
import { SabFileSecurityPanel } from './sab-file-security-panel';
import type { SabfilesNode, SabFileMember } from './types';

export interface SabFileDetailsPanelProps {
    node: SabfilesNode | null;
    members?: SabFileMember[];
    /** Human-readable folder path, e.g. "My files / Design". */
    pathLabel?: string;
    mode: 'rail' | 'sheet';
    open: boolean;
    onClose: () => void;
    onDownload?: (node: SabfilesNode) => void;
    onShare?: (node: SabfilesNode) => void;
    onRename?: (node: SabfilesNode) => void;
    onTrash?: (node: SabfilesNode) => void;
}

function PropRow({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
    return (
        <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span className="text-[var(--st-text-secondary)]">{label}</span>
            <span className="truncate text-right font-medium text-[var(--st-text)]">{value}</span>
        </div>
    );
}

function DetailsBody({
    node,
    members,
    pathLabel,
    onClose,
    onDownload,
    onShare,
    onRename,
    onTrash,
    showClose,
}: Omit<SabFileDetailsPanelProps, 'mode' | 'open'> & { node: SabfilesNode; showClose?: boolean }) {
    const badge = fileTypeBadge(node);
    const isFolder = node.type === 'folder';
    const owner = members?.find((m) => m.isOwner);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between px-4 pt-4">
                <h2 className="text-base font-semibold text-[var(--st-text)]">Details</h2>
                {showClose ? (
                    <IconButton label="Close details" icon={X} variant="ghost" size="sm" onClick={onClose} />
                ) : null}
            </div>

            <ScrollArea className="min-h-0 flex-1" viewportClassName="px-4 pb-4">
                {/* Preview */}
                <div className="mt-3 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                    {isImageNode(node) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={node.url} alt={node.name} className="h-full w-full object-cover" />
                    ) : (
                        <span
                            className="flex h-16 w-16 items-center justify-center rounded-[var(--st-radius-lg)]"
                            style={{ background: tint(badge.color, 16), color: badge.color }}
                            aria-hidden="true"
                        >
                            <badge.Icon size={34} />
                        </span>
                    )}
                </div>

                {/* Name + type */}
                <div className="mt-3 flex items-center gap-3">
                    <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius)]"
                        style={{ background: tint(badge.color, 14), color: badge.color }}
                        aria-hidden="true"
                    >
                        <badge.Icon size={18} />
                    </span>
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--st-text)]">{node.name}</div>
                        <div className="text-xs text-[var(--st-text-secondary)]">
                            {isFolder ? 'Folder' : `${badge.label} file`}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap gap-2">
                    {!isFolder && onDownload ? (
                        <Button variant="secondary" size="sm" iconLeft={Download} onClick={() => onDownload(node)}>
                            Download
                        </Button>
                    ) : null}
                    {onShare ? (
                        <Button variant="secondary" size="sm" iconLeft={Share2} onClick={() => onShare(node)}>
                            Share
                        </Button>
                    ) : null}
                    {onRename ? (
                        <IconButton label="Rename" icon={Pencil} variant="outline" size="sm" onClick={() => onRename(node)} />
                    ) : null}
                    {onTrash ? (
                        <IconButton label="Move to trash" icon={Trash2} variant="outline" size="sm" onClick={() => onTrash(node)} />
                    ) : null}
                </div>

                {/* Property */}
                <div className="mt-5">
                    <h3 className="mb-1 text-sm font-semibold text-[var(--st-text)]">Property</h3>
                    <div className="divide-y divide-[var(--st-border)]">
                        {!isFolder ? <PropRow label="Size" value={formatBytes(node.size)} /> : null}
                        <PropRow label="Owner" value={owner ? owner.name || owner.email : '—'} />
                        <PropRow label="Created at" value={formatDate(node.createdAt)} />
                    </div>
                </div>

                {/* More details */}
                <div className="mt-5">
                    <h3 className="mb-1 text-sm font-semibold text-[var(--st-text)]">More details</h3>
                    <div className="divide-y divide-[var(--st-border)]">
                        <PropRow label="Last edit" value={formatDate(node.updatedAt)} />
                        <PropRow label="Path" value={pathLabel || 'My files'} />
                        {node.shareToken ? (
                            <PropRow label="Link" value={<Badge tone="info" kind="soft">Public</Badge>} />
                        ) : null}
                    </div>
                </div>

                {/* Security & document governance */}
                <SabFileSecurityPanel node={node} />

                {/* Members */}
                {members && members.length > 0 ? (
                    <div className="mt-5">
                        <h3 className="mb-2 text-sm font-semibold text-[var(--st-text)]">People with access</h3>
                        <ul className="flex flex-col gap-2">
                            {members.map((m) => (
                                <li key={m.userId} className="flex items-center gap-2">
                                    <Avatar name={m.name || m.email} src={m.image} size="sm" shape="round" />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm text-[var(--st-text)]">{m.name || m.email}</div>
                                        <div className="truncate text-xs text-[var(--st-text-tertiary)]">{m.email}</div>
                                    </div>
                                    <Badge tone="neutral" kind="soft">
                                        {m.isOwner ? 'Owner' : m.role}
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}
            </ScrollArea>
        </div>
    );
}

export function SabFileDetailsPanel({
    node,
    mode,
    open,
    onClose,
    ...rest
}: SabFileDetailsPanelProps): React.JSX.Element | null {
    if (mode === 'sheet') {
        return (
            <Sheet open={open && !!node} onOpenChange={(o) => !o && onClose()}>
                <SheetContent side="right" className="w-[380px] max-w-[90vw] p-0">
                    <SheetHeader className="sr-only">
                        <SheetTitle>File details</SheetTitle>
                        <SheetDescription>Properties and people with access.</SheetDescription>
                    </SheetHeader>
                    {node ? <DetailsBody node={node} onClose={onClose} {...rest} /> : null}
                </SheetContent>
            </Sheet>
        );
    }

    // Rail mode — inline docked column; render only when a node is open.
    if (!open || !node) return null;
    return (
        <aside className="w-[340px] shrink-0 overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)]">
            <DetailsBody node={node} onClose={onClose} showClose {...rest} />
        </aside>
    );
}
