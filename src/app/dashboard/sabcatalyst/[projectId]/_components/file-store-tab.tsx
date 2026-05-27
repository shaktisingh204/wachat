'use client';

/** File Store tab — SabFiles-backed list + upload. NO URL paste. */
import React from 'react';

import {
    registerSabcatalystFile,
    deleteSabcatalystFile,
} from '@/app/actions/sabcatalyst.actions';
import {
    Button,
    Card,
    Input,
    Label,
    EmptyState,
    Badge,
} from '@/components/zoruui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import type { SabcatalystFileStoreEntry } from '@/lib/rust-client/sabcatalyst-file-store';

interface Props { projectId: string; initialFiles: SabcatalystFileStoreEntry[] }

export function FileStoreTab({ projectId, initialFiles }: Props) {
    const [files, setFiles] = React.useState(initialFiles);
    const [pendingKey, setPendingKey] = React.useState('');

    async function upload(pick: SabFilePick) {
        const key = pendingKey.trim() || pick.name || `file-${Date.now()}`;
        const f = await registerSabcatalystFile({
            projectId,
            key,
            sabfilesFileId: pick.id,
            sizeBytes: pick.size ?? 0,
            contentType: pick.mime ?? 'application/octet-stream',
        });
        setFiles((s) => [f, ...s]);
        setPendingKey('');
    }

    async function remove(id: string) {
        if (!confirm('Delete file entry? (SabFiles blob is preserved.)')) return;
        await deleteSabcatalystFile(id, projectId);
        setFiles((s) => s.filter((x) => x._id !== id));
    }

    return (
        <div className="space-y-4">
            <Card className="p-4 flex items-end gap-3">
                <div className="flex-1">
                    <Label htmlFor="key">Key (path) — optional, defaults to filename</Label>
                    <Input
                        id="key"
                        value={pendingKey}
                        onChange={(e) => setPendingKey(e.target.value)}
                        placeholder="assets/logo.png"
                    />
                </div>
                <SabFilePickerButton onPick={upload}>Upload from SabFiles</SabFilePickerButton>
            </Card>

            {files.length === 0 ? (
                <EmptyState title="No files yet" description="Upload from SabFiles to register a project-scoped key." />
            ) : (
                <div className="space-y-2">
                    {files.map((f) => (
                        <Card key={f._id} className="p-4 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <p className="font-mono text-sm truncate">{f.key}</p>
                                <p className="text-xs text-[var(--zoru-muted-foreground)] mt-1">
                                    {f.contentType} • {(f.sizeBytes / 1024).toFixed(1)} KB
                                    {f.public ? <Badge className="ml-2" variant="outline">public</Badge> : null}
                                </p>
                            </div>
                            <Button variant="destructive" onClick={() => remove(f._id)}>
                                Delete
                            </Button>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
