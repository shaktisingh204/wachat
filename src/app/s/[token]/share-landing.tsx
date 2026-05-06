'use client';

import * as React from 'react';
import { Download, FileImage, FileText, FileVideo, File as FileIcon, Lock } from 'lucide-react';

import {
    ZoruButton,
    ZoruCard,
    ZoruCardContent,
    ZoruCardDescription,
    ZoruCardHeader,
    ZoruCardTitle,
    ZoruInput,
    ZoruLabel,
    useZoruToast,
} from '@/components/zoruui';
import { fetchPublicDownloadUrl } from './actions';
import type { PublicShareView } from '@/lib/rust-client/sabfiles';

function previewIcon(mime?: string): React.ReactElement {
    if (mime?.startsWith('image/')) return <FileImage className="h-12 w-12 text-violet-500" />;
    if (mime?.startsWith('video/')) return <FileVideo className="h-12 w-12 text-rose-500" />;
    if (mime?.includes('text') || mime?.includes('pdf'))
        return <FileText className="h-12 w-12 text-sky-500" />;
    return <FileIcon className="h-12 w-12 text-zoru-ink-muted" />;
}

function fmtSize(bytes?: number): string {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    const u = ['KB', 'MB', 'GB', 'TB'];
    let v = bytes / 1024;
    let i = 0;
    while (v >= 1024 && i < u.length - 1) {
        v /= 1024;
        i += 1;
    }
    return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}

export function ShareLanding({
    token,
    view,
}: {
    token: string;
    view: PublicShareView;
}) {
    const [password, setPassword] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const { toast } = useZoruToast();

    const onDownload = async () => {
        setBusy(true);
        const res = await fetchPublicDownloadUrl(token, password);
        setBusy(false);
        if ('error' in res) {
            toast({ title: 'Could not download', description: res.error, variant: 'destructive' });
            return;
        }
        window.location.href = res.url;
    };

    return (
        <div className="zoruui flex min-h-screen items-center justify-center bg-zoru-bg p-6">
            <ZoruCard className="w-full max-w-md">
                <ZoruCardHeader className="items-center text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zoru-surface">
                        {view.thumbnail_url && view.mime?.startsWith('image/') ? (
                            <img
                                src={view.thumbnail_url}
                                alt={view.name}
                                className="h-full w-full rounded-full object-cover"
                            />
                        ) : (
                            previewIcon(view.mime)
                        )}
                    </div>
                    <ZoruCardTitle className="mt-3 break-all">{view.name}</ZoruCardTitle>
                    <ZoruCardDescription>
                        Shared on SabFiles · {view.type === 'folder' ? 'Folder' : fmtSize(view.size)}
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="flex flex-col gap-3">
                    {view.password_protected && (
                        <div className="grid gap-1.5">
                            <ZoruLabel>
                                <Lock className="mr-1 inline h-3.5 w-3.5" />
                                Password
                            </ZoruLabel>
                            <ZoruInput
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                            />
                        </div>
                    )}
                    {view.download_enabled && view.type === 'file' ? (
                        <ZoruButton onClick={onDownload} disabled={busy}>
                            <Download /> Download
                        </ZoruButton>
                    ) : (
                        <ZoruButton variant="outline" disabled>
                            Downloads disabled
                        </ZoruButton>
                    )}
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}
