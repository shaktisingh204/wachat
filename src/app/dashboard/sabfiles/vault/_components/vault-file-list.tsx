'use client';

/**
 * Sab Vault — the decrypted file list (unlocked state).
 *
 * Vault rows are bespoke: the node's stored `name` is the placeholder
 * "Encrypted file", so we render the client-decrypted display name instead. No
 * thumbnails (the bytes in R2 are ciphertext) — every row carries a lock glyph.
 */

import * as React from 'react';
import { FileLock2, Loader2, Lock, ShieldCheck, Trash2 } from 'lucide-react';

import { Badge, Button, EmptyState, IconButton } from '@/components/sabcrm/20ui';
import type { SabfilesNode } from '@/lib/rust-client/sabfiles';
import { formatBytes } from '@/components/sabfiles/views';

export type VaultDisplay = { name: string; mime?: string };

function formatDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

type VaultFileListProps = {
    nodes: SabfilesNode[];
    displays: Record<string, VaultDisplay>;
    busyId: string | null;
    onDownload: (node: SabfilesNode) => void;
    onDelete: (node: SabfilesNode) => void;
};

export function VaultFileList({
    nodes,
    displays,
    busyId,
    onDownload,
    onDelete,
}: VaultFileListProps): React.JSX.Element {
    if (nodes.length === 0) {
        return (
            <EmptyState
                icon={ShieldCheck}
                tone="accent"
                title="Your vault is empty"
                description="Files you add here are encrypted on this device before they ever leave it. Add your first file to get started."
            />
        );
    }

    return (
        <ul className="sv-list" aria-label="Encrypted vault files">
            {nodes.map((node) => {
                const display = displays[node.id];
                const name = display?.name ?? 'Encrypted file';
                const busy = busyId === node.id;
                return (
                    <li key={node.id} className="sv-row">
                        <span className="sv-row__glyph" aria-hidden="true">
                            <FileLock2 size={18} />
                        </span>
                        <div className="sv-row__main">
                            <p className="sv-row__name" title={name}>
                                {name}
                            </p>
                            <p className="sv-row__meta">
                                <span>{formatBytes(node.size)}</span>
                                {node.createdAt ? (
                                    <>
                                        <span className="sv-row__dot" aria-hidden="true" />
                                        <span>Added {formatDate(node.createdAt)}</span>
                                    </>
                                ) : null}
                            </p>
                        </div>
                        <Badge tone="accent" kind="soft" className="sv-row__badge">
                            <Lock size={11} aria-hidden="true" />
                            Encrypted
                        </Badge>
                        <div className="sv-row__actions">
                            <Button
                                size="sm"
                                variant="secondary"
                                iconLeft={busy ? Loader2 : undefined}
                                loading={busy}
                                onClick={() => onDownload(node)}
                                disabled={busy}
                                aria-label={`Decrypt and download ${name}`}
                            >
                                Download
                            </Button>
                            <IconButton
                                label={`Delete ${name}`}
                                icon={Trash2}
                                size="sm"
                                variant="ghost"
                                onClick={() => onDelete(node)}
                                disabled={busy}
                            />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
