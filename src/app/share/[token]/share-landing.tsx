'use client';

import * as React from 'react';
import {
    Check,
    Copy,
    Download,
    ExternalLink,
    File as FileIcon,
    FileImage,
    FileText,
    FileVideo,
    Lock,
    ShieldCheck,
} from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruCardContent,
    ZoruInput,
    ZoruLabel,
    cn,
    useZoruToast,
} from '@/components/zoruui';
import { fetchPublicDownloadUrl } from './actions';
import type { PublicShareView } from '@/lib/rust-client/sabfiles';
import { formatShareFileSize, getSharePreviewKind } from '@/lib/sabfiles/share-ui';

function previewIcon(mime?: string): React.ReactElement {
    if (mime?.startsWith('image/')) return <FileImage className="h-16 w-16 text-violet-500" />;
    if (mime?.startsWith('video/')) return <FileVideo className="h-16 w-16 text-rose-500" />;
    if (mime?.includes('text') || mime?.includes('pdf'))
        return <FileText className="h-16 w-16 text-sky-500" />;
    return <FileIcon className="h-16 w-16 text-zoru-ink-muted" />;
}

function typeLabel(view: PublicShareView): string {
    if (view.type === 'folder') return 'Folder';
    if (view.mime?.startsWith('image/')) return 'Image';
    if (view.mime?.startsWith('video/')) return 'Video';
    if (view.mime?.includes('pdf')) return 'PDF';
    if (view.mime?.includes('text')) return 'Text document';
    return view.mime || 'File';
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
    const [copied, setCopied] = React.useState(false);
    const { toast } = useZoruToast();
    const previewKind = getSharePreviewKind(view.mime);
    const canPreviewImage = view.thumbnail_url && previewKind === 'image';
    const shareUrl = typeof window !== 'undefined' ? window.location.href : `/share/${token}`;

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

    const onCopy = () => {
        navigator.clipboard?.writeText(shareUrl).then(
            () => {
                setCopied(true);
                toast({ title: 'Share link copied' });
                window.setTimeout(() => setCopied(false), 1600);
            },
            () => toast({ title: 'Copy failed', variant: 'destructive' }),
        );
    };

    return (
        <main className="zoruui min-h-screen bg-zoru-bg">
            <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line pb-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-zoru-ink">SabFiles</span>
                            <ZoruBadge variant={view.password_protected ? 'warning' : 'success'}>
                                {view.password_protected ? <Lock /> : <ShieldCheck />}
                                {view.password_protected ? 'Protected link' : 'Public link'}
                            </ZoruBadge>
                            {!view.download_enabled && <ZoruBadge variant="ghost">View only</ZoruBadge>}
                        </div>
                        <h1 className="mt-2 break-words text-2xl font-semibold tracking-normal text-zoru-ink sm:text-3xl">
                            {view.name}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <ZoruButton variant="outline" onClick={onCopy}>
                            {copied ? <Check /> : <Copy />}
                            {copied ? 'Copied' : 'Copy link'}
                        </ZoruButton>
                        {view.download_enabled && view.type === 'file' && (
                            <ZoruButton onClick={onDownload} disabled={busy}>
                                <Download />
                                {busy ? 'Preparing...' : 'Download'}
                            </ZoruButton>
                        )}
                    </div>
                </header>

                <section className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="flex min-h-[52vh] items-center justify-center overflow-hidden rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface">
                        {canPreviewImage ? (
                            <img
                                src={view.thumbnail_url}
                                alt={view.name}
                                className="max-h-[74vh] w-full object-contain"
                            />
                        ) : previewKind === 'video' && view.thumbnail_url ? (
                            <video
                                src={view.thumbnail_url}
                                className="max-h-[74vh] w-full"
                                controls
                                preload="metadata"
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-4 p-10 text-center">
                                <div className="flex h-28 w-28 items-center justify-center rounded-full border border-zoru-line bg-zoru-bg">
                                    {previewIcon(view.mime)}
                                </div>
                                <div>
                                    <div className="text-base font-medium text-zoru-ink">
                                        Preview unavailable
                                    </div>
                                    <p className="mt-1 max-w-sm text-sm text-zoru-ink-muted">
                                        Download the file to open it in the best app for this format.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <aside className="flex flex-col gap-4">
                        <ZoruCard>
                            <ZoruCardContent className="flex flex-col gap-4 p-4">
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-zoru-ink-muted">
                                        Shared item
                                    </div>
                                    <div className="mt-1 break-words text-sm font-medium text-zoru-ink">
                                        {view.name}
                                    </div>
                                </div>
                                <dl className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-[var(--zoru-radius)] bg-zoru-surface p-3">
                                        <dt className="text-xs text-zoru-ink-muted">Type</dt>
                                        <dd className="mt-1 font-medium text-zoru-ink">{typeLabel(view)}</dd>
                                    </div>
                                    <div className="rounded-[var(--zoru-radius)] bg-zoru-surface p-3">
                                        <dt className="text-xs text-zoru-ink-muted">Size</dt>
                                        <dd className="mt-1 font-medium text-zoru-ink">
                                            {view.type === 'folder' ? 'Folder' : formatShareFileSize(view.size)}
                                        </dd>
                                    </div>
                                    <div className="rounded-[var(--zoru-radius)] bg-zoru-surface p-3">
                                        <dt className="text-xs text-zoru-ink-muted">Access</dt>
                                        <dd className="mt-1 font-medium text-zoru-ink">
                                            {view.password_protected ? 'Password' : 'Link'}
                                        </dd>
                                    </div>
                                    <div className="rounded-[var(--zoru-radius)] bg-zoru-surface p-3">
                                        <dt className="text-xs text-zoru-ink-muted">Download</dt>
                                        <dd className="mt-1 font-medium text-zoru-ink">
                                            {view.download_enabled ? 'Allowed' : 'Disabled'}
                                        </dd>
                                    </div>
                                </dl>
                            </ZoruCardContent>
                        </ZoruCard>

                        {view.password_protected && (
                            <ZoruCard>
                                <ZoruCardContent className="grid gap-2 p-4">
                                    <ZoruLabel>
                                        <Lock className="mr-1 inline h-3.5 w-3.5" />
                                        Password required
                                    </ZoruLabel>
                                    <ZoruInput
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter password"
                                    />
                                </ZoruCardContent>
                            </ZoruCard>
                        )}

                        <ZoruCard>
                            <ZoruCardContent className="grid gap-2 p-4">
                                <ZoruButton
                                    onClick={onDownload}
                                    disabled={busy || !view.download_enabled || view.type !== 'file'}
                                    block
                                >
                                    <Download />
                                    {view.download_enabled ? 'Download file' : 'Downloads disabled'}
                                </ZoruButton>
                                <ZoruButton variant="outline" onClick={onCopy} block>
                                    {copied ? <Check /> : <Copy />}
                                    Copy share link
                                </ZoruButton>
                                {canPreviewImage && (
                                    <ZoruButton variant="ghost" asChild block>
                                        <a href={view.thumbnail_url} target="_blank" rel="noreferrer">
                                            <ExternalLink />
                                            Open preview
                                        </a>
                                    </ZoruButton>
                                )}
                            </ZoruCardContent>
                        </ZoruCard>

                        <p className={cn('text-xs leading-5 text-zoru-ink-muted')}>
                            This link was shared through SabFiles. Only people with this link can view
                            this page; password-protected links require the owner-provided password.
                        </p>
                    </aside>
                </section>
            </div>
        </main>
    );
}
