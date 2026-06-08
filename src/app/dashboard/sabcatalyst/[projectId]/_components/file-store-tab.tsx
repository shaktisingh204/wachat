'use client';

/** File Store tab — SabFiles-backed list + upload. NO URL paste. */
import React from 'react';
import { FileBox, Trash2, UploadCloud } from 'lucide-react';

import {
    registerSabcatalystFile,
    deleteSabcatalystFile,
} from '@/app/actions/sabcatalyst.actions';
import {
    Badge,
    Button,
    Card,
    CardBody,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    Field,
    Input,
} from '@/components/sabcrm/20ui';
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
        if (!confirm('Delete file entry? The SabFiles blob is preserved.')) return;
        await deleteSabcatalystFile(id, projectId);
        setFiles((s) => s.filter((x) => x._id !== id));
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <UploadCloud size={16} aria-hidden="true" />
                        <CardTitle>Upload a file</CardTitle>
                    </div>
                    <CardDescription>
                        Register a project-scoped key backed by a SabFiles blob.
                    </CardDescription>
                </CardHeader>
                <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <Field
                        label="Key (path)"
                        help="Optional, defaults to the filename."
                        className="flex-1"
                    >
                        <Input
                            value={pendingKey}
                            onChange={(e) => setPendingKey(e.target.value)}
                            placeholder="assets/logo.png"
                        />
                    </Field>
                    <SabFilePickerButton onPick={upload}>
                        <UploadCloud size={14} aria-hidden="true" />
                        Upload from SabFiles
                    </SabFilePickerButton>
                </CardBody>
            </Card>

            {files.length === 0 ? (
                <Card>
                    <CardBody className="p-6">
                        <EmptyState
                            icon={FileBox}
                            title="No files yet"
                            description="Upload from SabFiles to register a project-scoped key."
                        />
                    </CardBody>
                </Card>
            ) : (
                <ul className="flex list-none flex-col gap-2 p-0">
                    {files.map((f) => (
                        <li key={f._id}>
                            <Card>
                                <CardBody className="flex items-center justify-between gap-4 p-4">
                                    <div className="min-w-0">
                                        <p className="flex items-center gap-2 truncate font-mono text-sm">
                                            <FileBox
                                                size={14}
                                                aria-hidden="true"
                                                className="shrink-0"
                                            />
                                            {f.key}
                                        </p>
                                        <p className="mt-1 flex items-center gap-2 text-xs text-[var(--st-text-secondary)] tabular-nums">
                                            {f.contentType} · {(f.sizeBytes / 1024).toFixed(1)} KB
                                            {f.public ? <Badge tone="info">public</Badge> : null}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        iconLeft={Trash2}
                                        onClick={() => remove(f._id)}
                                        aria-label={`Delete ${f.key}`}
                                    >
                                        Delete
                                    </Button>
                                </CardBody>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
