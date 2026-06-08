'use client';

import {
    Badge,
    Button,
    Card,
    CardBody,
    Field,
    Input,
    PageActions,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    cn,
    useToast,
} from '@/components/sabcrm/20ui';
import {
    Check,
    Copy,
    Download,
    Eye,
    ExternalLink,
    FileAudio,
    File as FileIcon,
    FileImage,
    FileText,
    FileVideo,
    Info,
    KeyRound,
    Link2,
    Lock,
    ShieldCheck,
} from 'lucide-react';

import * as React from 'react';

import { fetchPublicDownloadUrl, fetchPublicPreviewUrl } from './actions';
import { useDebounce } from 'use-debounce';
import type { PublicShareView } from '@/lib/rust-client/sabfiles';
import {
    formatShareFileSize,
    getShareAccessLabel,
    getShareFileExtension,
    getSharePreviewKind,
} from '@/lib/sabfiles/share-ui';

function previewIcon(mime?: string, className = 'h-14 w-14'): React.ReactElement {
    if (mime?.startsWith('image/'))
        return <FileImage className={cn(className, 'text-violet-500')} aria-hidden="true" />;
    if (mime?.startsWith('video/'))
        return <FileVideo className={cn(className, 'text-rose-500')} aria-hidden="true" />;
    if (mime?.startsWith('audio/'))
        return <FileAudio className={cn(className, 'text-emerald-500')} aria-hidden="true" />;
    if (mime?.includes('text') || mime?.includes('pdf'))
        return <FileText className={cn(className, 'text-sky-500')} aria-hidden="true" />;
    return <FileIcon className={cn(className, 'text-[var(--st-text-secondary)]')} aria-hidden="true" />;
}

function typeLabel(view: PublicShareView): string {
    if (view.type === 'folder') return 'Folder';
    if (view.mime?.startsWith('image/')) return 'Image';
    if (view.mime?.startsWith('video/')) return 'Video';
    if (view.mime?.startsWith('audio/')) return 'Audio';
    if (view.mime?.includes('pdf')) return 'PDF';
    if (view.mime?.includes('text')) return 'Text document';
    if (view.mime?.includes('officedocument') || view.mime?.includes('msword')) return 'Office document';
    return view.mime || 'File';
}

function isRenderablePreview(previewKind: ReturnType<typeof getSharePreviewKind>): boolean {
    return previewKind !== 'file';
}

function officePreviewUrl(url: string): string {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

function ShareStat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
            <dt className="text-xs text-[var(--st-text-secondary)]">{label}</dt>
            <dd className="mt-1 min-w-0 break-words text-sm font-medium text-[var(--st-text)]">{value}</dd>
        </div>
    );
}

export function ShareLanding({
    token,
    view,
}: {
    token: string;
    view: PublicShareView;
}) {
    const [password, setPassword] = React.useState('');
    const [debouncedPassword] = useDebounce(password, 500);
    const [busy, setBusy] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const [previewUrl, setPreviewUrl] = React.useState<string | undefined>(view.thumbnail_url);
    const [previewError, setPreviewError] = React.useState<string | null>(null);
    const { toast } = useToast();
    const previewKind = getSharePreviewKind(view.mime);
    const canLoadPreview = view.type === 'file' && isRenderablePreview(previewKind);
    const extension = getShareFileExtension(view.name);
    const accessLabel = getShareAccessLabel(view.password_protected, view.download_enabled);
    const fileSize = view.type === 'folder' ? 'Folder' : formatShareFileSize(view.size);

    React.useEffect(() => {
        let cancelled = false;
        setPreviewError(null);

        if (!canLoadPreview) {
            setPreviewUrl(undefined);
            return;
        }
        if (view.password_protected && !debouncedPassword) {
            setPreviewUrl(undefined);
            return;
        }

        fetchPublicPreviewUrl(token, debouncedPassword).then((res) => {
            if (cancelled) return;
            if ('error' in res) {
                setPreviewUrl(undefined);
                setPreviewError(res.error);
                return;
            }
            setPreviewUrl(res.url);
        });

        return () => {
            cancelled = true;
        };
    }, [canLoadPreview, debouncedPassword, token, view.password_protected]);

    const onDownload = async () => {
        if (busy || !view.download_enabled || view.type !== 'file') return;
        setBusy(true);
        try {
            const res = await fetchPublicDownloadUrl(token, password);
            if ('error' in res) {
                toast({ title: 'Could not download', description: res.error, tone: 'danger' });
                return;
            }
            window.location.href = res.url;
        } catch (error) {
            toast.error('Could not download');
        } finally {
            setBusy(false);
        }
    };

    const onCopy = () => {
        const currentShareUrl =
            typeof window !== 'undefined' ? window.location.href : `/share/${token}`;

        if (!navigator.clipboard) {
            toast.error('Copy failed');
            return;
        }

        navigator.clipboard.writeText(currentShareUrl).then(
            () => {
                setCopied(true);
                toast.success('Share link copied');
                window.setTimeout(() => setCopied(false), 1600);
            },
            () => toast.error('Copy failed'),
        );
    };

    const onPasswordKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') void onDownload();
    };

    const openInNewTab = (url: string) => {
        if (typeof window !== 'undefined') {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <main className="20ui min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
            <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
                <PageHeader className="flex flex-wrap items-end justify-between gap-3">
                    <PageHeaderHeading className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-semibold text-[var(--st-text)]">SabFiles</span>
                            <Badge variant={view.password_protected ? 'warning' : 'success'}>
                                {view.password_protected ? (
                                    <KeyRound size={12} aria-hidden="true" />
                                ) : (
                                    <ShieldCheck size={12} aria-hidden="true" />
                                )}
                                {view.password_protected ? 'Password protected' : 'Ready to view'}
                            </Badge>
                            <Badge variant={view.download_enabled ? 'info' : 'secondary'}>
                                {view.download_enabled ? (
                                    <Download size={12} aria-hidden="true" />
                                ) : (
                                    <Eye size={12} aria-hidden="true" />
                                )}
                                {view.download_enabled ? 'Download enabled' : 'View only'}
                            </Badge>
                        </div>
                        <PageTitle className="mt-2 break-words">{view.name}</PageTitle>
                        <PageDescription className="mt-2 flex flex-wrap items-center gap-2">
                            <span>{typeLabel(view)}</span>
                            <span aria-hidden="true">/</span>
                            <span>{fileSize}</span>
                            <span aria-hidden="true">/</span>
                            <span>{accessLabel}</span>
                        </PageDescription>
                    </PageHeaderHeading>
                    <PageActions>
                        <Button variant="outline" onClick={onCopy}>
                            {copied ? <Check /> : <Copy />}
                            {copied ? 'Copied' : 'Copy link'}
                        </Button>
                        {view.download_enabled && view.type === 'file' && (
                            <Button variant="primary" onClick={onDownload} disabled={busy} loading={busy}>
                                <Download />
                                {busy ? 'Preparing...' : 'Download'}
                            </Button>
                        )}
                    </PageActions>
                </PageHeader>

                <section className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <section className="min-w-0 overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)]">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-border)] px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]">
                                    {previewIcon(view.mime, 'h-5 w-5')}
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-[var(--st-text)]">
                                        File preview
                                    </div>
                                    <div className="truncate text-xs text-[var(--st-text-secondary)]">
                                        {extension === 'Unknown' ? typeLabel(view) : extension}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary">{previewKind}</Badge>
                                {previewUrl && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            openInNewTab(
                                                previewKind === 'office'
                                                    ? officePreviewUrl(previewUrl)
                                                    : previewUrl,
                                            )
                                        }
                                    >
                                        <ExternalLink />
                                        Open
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="flex min-h-[56vh] items-center justify-center bg-[var(--st-bg-secondary)] p-4 sm:p-6">
                            {previewKind === 'image' && previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt={view.name}
                                    className="max-h-[72vh] w-full rounded-[var(--st-radius)] object-contain"
                                />
                            ) : previewKind === 'video' && previewUrl ? (
                                <video
                                    src={previewUrl}
                                    className="max-h-[72vh] w-full rounded-[var(--st-radius)] bg-black"
                                    controls
                                    preload="metadata"
                                />
                            ) : previewKind === 'audio' && previewUrl ? (
                                <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 p-8">
                                    <div className="flex h-24 w-24 items-center justify-center rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)]">
                                        {previewIcon(view.mime)}
                                    </div>
                                    <audio src={previewUrl} className="w-full" controls preload="metadata" />
                                </div>
                            ) : previewKind === 'document' && previewUrl ? (
                                <iframe
                                    src={previewUrl}
                                    title={view.name}
                                    className="h-[72vh] w-full rounded-[var(--st-radius)] border-0 bg-white"
                                />
                            ) : previewKind === 'office' && previewUrl ? (
                                <iframe
                                    src={officePreviewUrl(previewUrl)}
                                    title={view.name}
                                    className="h-[72vh] w-full rounded-[var(--st-radius)] border-0 bg-white"
                                />
                            ) : (
                                <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-8 text-center">
                                    <div className="flex h-24 w-24 items-center justify-center rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)]">
                                        {previewIcon(view.mime)}
                                    </div>
                                    <div>
                                        <div className="text-base font-medium text-[var(--st-text)]">
                                            {canLoadPreview ? 'Preview locked' : 'Preview unavailable'}
                                        </div>
                                        <p className="mt-1 text-sm leading-6 text-[var(--st-text-secondary)]">
                                            {view.password_protected && !password
                                                ? 'Enter the share password to show the preview.'
                                                : previewError ||
                                                  'This file type does not have an inline preview. Use the action panel to download it when downloads are allowed.'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--st-border)] px-4 py-3 text-sm text-[var(--st-text-secondary)]">
                            <span className="min-w-0 truncate">{view.name}</span>
                            <span>{fileSize}</span>
                        </div>
                    </section>

                    <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
                        <Card padding="none">
                            <CardBody className="flex flex-col gap-4 p-4">
                                <div>
                                    <div className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                                        Quick actions
                                    </div>
                                    <div className="mt-1 text-base font-semibold text-[var(--st-text)]">
                                        Shared file controls
                                    </div>
                                </div>

                                {view.password_protected && (
                                    <Field
                                        label={
                                            <span className="inline-flex items-center gap-1">
                                                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                                                Password required
                                            </span>
                                        }
                                        help="Enter the owner-provided password before previewing or downloading."
                                    >
                                        <Input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onKeyDown={onPasswordKeyDown}
                                            placeholder="Enter password"
                                        />
                                    </Field>
                                )}

                                <Button
                                    variant="primary"
                                    onClick={onDownload}
                                    disabled={busy || !view.download_enabled || view.type !== 'file'}
                                    loading={busy}
                                    block
                                >
                                    <Download />
                                    {view.download_enabled ? 'Download file' : 'Downloads disabled'}
                                </Button>
                                <Button variant="outline" onClick={onCopy} block>
                                    {copied ? <Check /> : <Link2 />}
                                    {copied ? 'Copied' : 'Copy share link'}
                                </Button>
                                {previewUrl && (
                                    <Button
                                        variant="ghost"
                                        onClick={() =>
                                            openInNewTab(
                                                previewKind === 'office'
                                                    ? officePreviewUrl(previewUrl)
                                                    : previewUrl,
                                            )
                                        }
                                        block
                                    >
                                        <ExternalLink />
                                        Open preview
                                    </Button>
                                )}
                            </CardBody>
                        </Card>

                        <Card padding="none">
                            <CardBody className="p-4">
                                <div className="mb-3 text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                                    File details
                                </div>
                                <dl className="grid grid-cols-2 gap-3">
                                    <ShareStat label="Type" value={typeLabel(view)} />
                                    <ShareStat label="Size" value={fileSize} />
                                    <ShareStat label="Access" value={accessLabel} />
                                    <ShareStat
                                        label="Download"
                                        value={view.download_enabled ? 'Allowed' : 'Disabled'}
                                    />
                                </dl>
                            </CardBody>
                        </Card>

                        <div
                            className={cn(
                                'rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4',
                                'text-sm leading-6 text-[var(--st-text-secondary)]',
                            )}
                        >
                            <div className="mb-1 flex items-center gap-2 font-medium text-[var(--st-text)]">
                                <Info className="h-4 w-4" aria-hidden="true" />
                                Secure share note
                            </div>
                            Only people with this link can view this page. Password protected links
                            require the owner-provided password before preview or download.
                        </div>
                    </aside>
                </section>
            </div>
        </main>
    );
}
