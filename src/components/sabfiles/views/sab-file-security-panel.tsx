'use client';

/**
 * Document-security (governance) section for the SabFiles details rail.
 *
 * Governance rides the share-link model: a single protected link carries the
 * password, expiry, access window, download/view limits, dynamic watermark, and
 * the access audit trail. Saving builds a `CreateShareBody` and calls
 * `createShare`; turning the master switch off (when a link exists) calls
 * `revokeShare`. The access log is read on demand from `getNodeAudit`.
 *
 * Renders as a rail SECTION (a titled `<div className="mt-5">…</div>`) — it does
 * NOT wrap itself in Sheet/Card chrome, so it slots cleanly under the existing
 * Property / More-details sections of `sab-file-details-panel.tsx` and inherits
 * its calm, dense, `--st-*`-token visual language.
 */

import * as React from 'react';
import {
    ChevronDown,
    Clock,
    Copy,
    Download,
    Droplet,
    Eye,
    KeyRound,
    Link2,
    ScrollText,
    Shield,
    ShieldOff,
} from 'lucide-react';

import { Badge, Button, Field, IconButton, Input, Spinner, Switch, useToast } from '@/components/sabcrm/20ui';

import { createShare, revokeShare } from '@/app/actions/sabfiles.actions';
import { getNodeAudit } from '@/app/actions/sabfiles-security.actions';
import type { CreateShareBody, SabfilesAuditEntry, SabfilesNode } from '@/lib/rust-client/sabfiles';

export interface SabFileSecurityPanelProps {
    node: SabfilesNode;
    /** Parent folder id — threaded through to createShare/revokeShare for revalidation. */
    parentId?: string | null;
}

const DEFAULT_WATERMARK_OPACITY = 0.15;
const MIN_WATERMARK_OPACITY = 0.05;
const MAX_WATERMARK_OPACITY = 0.5;

/** ISO string -> `datetime-local` value (local wall-clock, no seconds/zone). */
function isoToLocalInput(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    // Shift by the local tz offset so the displayed value matches wall-clock.
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

/** `datetime-local` value -> ISO string (or null when cleared/invalid). */
function localInputToIso(value: string): string | null {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}

/** Parse a numeric input into a positive int, or null for empty/invalid. */
function toPositiveIntOrNull(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
}

function clampOpacity(n: number): number {
    if (!Number.isFinite(n)) return DEFAULT_WATERMARK_OPACITY;
    return Math.min(MAX_WATERMARK_OPACITY, Math.max(MIN_WATERMARK_OPACITY, n));
}

/** Humanise an audit action key, e.g. `share.download` -> "Download". */
function auditActionLabel(action: string): string {
    const last = action.split(/[._:/]/).filter(Boolean).pop() || action;
    const spaced = last.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatAuditTime(at?: string | null): string {
    if (!at) return 'Unknown time';
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return 'Unknown time';
    return d.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function truncateUa(ua?: string | null): string {
    if (!ua) return '';
    return ua.length > 64 ? `${ua.slice(0, 63)}…` : ua;
}

/** A labelled row mirroring the details panel's section rhythm. */
function ControlRow({
    label,
    htmlFor,
    hint,
    children,
}: {
    label: React.ReactNode;
    htmlFor: string;
    hint?: React.ReactNode;
    children: React.ReactNode;
}): React.JSX.Element {
    return (
        <div className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
                <label htmlFor={htmlFor} className="block text-sm text-[var(--st-text)]">
                    {label}
                </label>
                {hint ? <span className="block text-xs text-[var(--st-text-tertiary)]">{hint}</span> : null}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

export function SabFileSecurityPanel({ node, parentId = null }: SabFileSecurityPanelProps): React.JSX.Element {
    const { toast } = useToast();
    const reactId = React.useId();
    const idFor = (key: string) => `${reactId}-${key}`;

    const isFolder = node.type === 'folder';
    const hasToken = Boolean(node.shareToken);

    // ── Local form state, seeded from the node's current share* fields ──────
    const [protectedLink, setProtectedLink] = React.useState<boolean>(hasToken);
    const [downloadEnabled, setDownloadEnabled] = React.useState<boolean>(node.shareDownloadEnabled ?? true);
    const [expiresAt, setExpiresAt] = React.useState<string>(isoToLocalInput(node.shareExpiresAt));
    const [notBefore, setNotBefore] = React.useState<string>(isoToLocalInput(node.shareNotBefore));
    const [maxDownloads, setMaxDownloads] = React.useState<string>(
        node.shareMaxDownloads != null ? String(node.shareMaxDownloads) : '',
    );
    const [maxViews, setMaxViews] = React.useState<string>(
        node.shareMaxViews != null ? String(node.shareMaxViews) : '',
    );
    const [auditEnabled, setAuditEnabled] = React.useState<boolean>(node.shareAuditEnabled ?? false);

    // Password: write-only. We never receive or render the value — `passwordSet`
    // reflects whether one exists; `password` carries a new/changed value (and
    // a single space sentinel means "clear it").
    const [passwordSet, setPasswordSet] = React.useState<boolean>(Boolean(node.sharePassword));
    const [editingPassword, setEditingPassword] = React.useState<boolean>(false);
    const [password, setPassword] = React.useState<string>('');

    // Watermark
    const [watermarkOn, setWatermarkOn] = React.useState<boolean>(node.shareWatermark?.enabled ?? false);
    const [watermarkText, setWatermarkText] = React.useState<string>(node.shareWatermark?.text ?? '');
    const [watermarkEmail, setWatermarkEmail] = React.useState<boolean>(
        node.shareWatermark?.includeViewerEmail ?? false,
    );
    const [watermarkOpacity, setWatermarkOpacity] = React.useState<number>(
        node.shareWatermark?.opacity ?? DEFAULT_WATERMARK_OPACITY,
    );

    const [saving, setSaving] = React.useState(false);
    const [revoking, setRevoking] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    // ── Audit trail (lazy) ──────────────────────────────────────────────────
    const [logOpen, setLogOpen] = React.useState(false);
    const [logLoading, setLogLoading] = React.useState(false);
    const [logLoaded, setLogLoaded] = React.useState(false);
    const [entries, setEntries] = React.useState<SabfilesAuditEntry[]>([]);
    const logRegionId = idFor('log-region');

    const shareUrl = React.useMemo(() => {
        if (!node.shareToken) return '';
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        return `${origin}/share/${node.shareToken}`;
    }, [node.shareToken]);

    const loadAudit = React.useCallback(async () => {
        setLogLoading(true);
        try {
            const res = await getNodeAudit(node.id);
            if ('error' in res) {
                toast({ title: 'Could not load access log', description: res.error, tone: 'danger' });
                return;
            }
            // Newest first.
            const sorted = [...res.entries].sort((a, b) => {
                const ta = a.at ? new Date(a.at).getTime() : 0;
                const tb = b.at ? new Date(b.at).getTime() : 0;
                return tb - ta;
            });
            setEntries(sorted);
            setLogLoaded(true);
        } catch {
            toast({ title: 'Could not load access log', tone: 'danger' });
        } finally {
            setLogLoading(false);
        }
    }, [node.id, toast]);

    const onToggleLog = () => {
        const next = !logOpen;
        setLogOpen(next);
        if (next && !logLoaded && !logLoading) void loadAudit();
    };

    const buildBody = React.useCallback((): CreateShareBody => {
        const body: CreateShareBody = {
            download_enabled: downloadEnabled,
            expires_at: localInputToIso(expiresAt),
            not_before: localInputToIso(notBefore),
            max_downloads: toPositiveIntOrNull(maxDownloads),
            max_views: toPositiveIntOrNull(maxViews),
            audit_enabled: auditEnabled,
        };

        // Password — only send when the user is actively setting/changing/clearing it.
        if (editingPassword) {
            // Empty input while editing clears the password; otherwise set it.
            body.password = password.length > 0 ? password : null;
        }

        // Watermark — files only; a folder share link has no inline preview.
        if (!isFolder) {
            body.watermark = watermarkOn
                ? {
                      enabled: true,
                      text: watermarkText.trim() || null,
                      include_viewer_email: watermarkEmail,
                      opacity: clampOpacity(watermarkOpacity),
                  }
                : { enabled: false };
        }

        return body;
    }, [
        downloadEnabled,
        expiresAt,
        notBefore,
        maxDownloads,
        maxViews,
        auditEnabled,
        editingPassword,
        password,
        isFolder,
        watermarkOn,
        watermarkText,
        watermarkEmail,
        watermarkOpacity,
    ]);

    const onSave = async () => {
        if (saving || revoking) return;
        setSaving(true);
        try {
            // Master switch off + a link exists -> revoke instead of (re)create.
            if (!protectedLink && hasToken) {
                const res = await revokeShare(node.id, parentId);
                if ('error' in res) {
                    toast({ title: 'Could not update protection', description: res.error, tone: 'danger' });
                    return;
                }
                toast({ title: 'Share link revoked', tone: 'success' });
                return;
            }

            const res = await createShare(node.id, buildBody(), parentId);
            if ('error' in res) {
                toast({ title: 'Could not save protection', description: res.error, tone: 'danger' });
                return;
            }

            // Sync local state with the authoritative response.
            setPasswordSet(res.password_protected);
            setDownloadEnabled(res.download_enabled);
            setAuditEnabled(res.audit_enabled);
            if (res.watermark) {
                setWatermarkOn(res.watermark.enabled);
                setWatermarkText(res.watermark.text ?? '');
                setWatermarkEmail(res.watermark.include_viewer_email);
                setWatermarkOpacity(res.watermark.opacity);
            }
            setEditingPassword(false);
            setPassword('');
            toast({ title: 'Protection saved', tone: 'success' });
        } catch {
            toast({ title: 'Could not save protection', tone: 'danger' });
        } finally {
            setSaving(false);
        }
    };

    const onRevoke = async () => {
        if (saving || revoking || !hasToken) return;
        setRevoking(true);
        try {
            const res = await revokeShare(node.id, parentId);
            if ('error' in res) {
                toast({ title: 'Could not revoke link', description: res.error, tone: 'danger' });
                return;
            }
            setProtectedLink(false);
            setPasswordSet(false);
            setEditingPassword(false);
            setPassword('');
            toast({ title: 'Share link revoked', tone: 'success' });
        } catch {
            toast({ title: 'Could not revoke link', tone: 'danger' });
        } finally {
            setRevoking(false);
        }
    };

    const onCopy = () => {
        if (!shareUrl || typeof navigator === 'undefined' || !navigator.clipboard) {
            toast({ title: 'Copy failed', tone: 'danger' });
            return;
        }
        navigator.clipboard.writeText(shareUrl).then(
            () => {
                setCopied(true);
                toast({ title: 'Link copied', tone: 'success' });
                window.setTimeout(() => setCopied(false), 1600);
            },
            () => toast({ title: 'Copy failed', tone: 'danger' }),
        );
    };

    const busy = saving || revoking;

    return (
        <div className="mt-5">
            <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--st-text)]">Security</h3>
                {passwordSet ? (
                    <Badge tone="warning" kind="soft">
                        <KeyRound className="h-3 w-3" aria-hidden="true" />
                        Password set
                    </Badge>
                ) : null}
            </div>
            <p className="mb-2 text-xs text-[var(--st-text-tertiary)]">
                Govern who can open this {isFolder ? 'folder' : 'file'} through its share link.
            </p>

            {/* Master toggle */}
            <ControlRow
                label={
                    <span className="inline-flex items-center gap-1.5 font-medium">
                        {protectedLink ? (
                            <Shield className="h-4 w-4 text-[var(--st-primary)]" aria-hidden="true" />
                        ) : (
                            <ShieldOff className="h-4 w-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                        )}
                        Protected share link
                    </span>
                }
                htmlFor={idFor('protected')}
                hint={protectedLink ? 'Anyone with the link, subject to the rules below' : 'Link is off'}
            >
                <Switch
                    id={idFor('protected')}
                    checked={protectedLink}
                    onCheckedChange={setProtectedLink}
                    aria-label="Protected share link"
                />
            </ControlRow>

            {protectedLink ? (
                <div className="divide-y divide-[var(--st-border)]">
                    {/* Downloads */}
                    <ControlRow
                        label={
                            <span className="inline-flex items-center gap-1.5">
                                <Download className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                                Allow downloads
                            </span>
                        }
                        htmlFor={idFor('downloads')}
                        hint="Viewers can save the original file"
                    >
                        <Switch
                            id={idFor('downloads')}
                            checked={downloadEnabled}
                            onCheckedChange={setDownloadEnabled}
                            aria-label="Allow downloads"
                        />
                    </ControlRow>

                    {/* Password (files only) */}
                    {!isFolder ? (
                        <div className="py-2.5">
                            <Field
                                id={idFor('password')}
                                label={
                                    <span className="inline-flex items-center gap-1.5">
                                        <KeyRound
                                            className="h-3.5 w-3.5 text-[var(--st-text-secondary)]"
                                            aria-hidden="true"
                                        />
                                        Password
                                    </span>
                                }
                                help={
                                    editingPassword
                                        ? 'Leave empty and save to remove the password'
                                        : passwordSet
                                          ? 'A password is required to open this link'
                                          : 'Require a password to open this link'
                                }
                            >
                                {editingPassword ? (
                                    <Input
                                        id={idFor('password')}
                                        type="password"
                                        value={password}
                                        autoComplete="new-password"
                                        placeholder={passwordSet ? 'New password' : 'Set a password'}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        iconLeft={KeyRound}
                                        onClick={() => {
                                            setEditingPassword(true);
                                            setPassword('');
                                        }}
                                    >
                                        {passwordSet ? 'Change password' : 'Set password'}
                                    </Button>
                                )}
                            </Field>
                        </div>
                    ) : null}

                    {/* Access window — starts */}
                    <div className="py-2.5">
                        <Field
                            id={idFor('not-before')}
                            label={
                                <span className="inline-flex items-center gap-1.5">
                                    <Clock
                                        className="h-3.5 w-3.5 text-[var(--st-text-secondary)]"
                                        aria-hidden="true"
                                    />
                                    Access starts
                                </span>
                            }
                            help="The link stays locked until this time. Empty for immediate access."
                        >
                            <Input
                                id={idFor('not-before')}
                                type="datetime-local"
                                value={notBefore}
                                onChange={(e) => setNotBefore(e.target.value)}
                            />
                        </Field>
                    </div>

                    {/* Access window — expires */}
                    <div className="py-2.5">
                        <Field
                            id={idFor('expires')}
                            label={
                                <span className="inline-flex items-center gap-1.5">
                                    <Clock
                                        className="h-3.5 w-3.5 text-[var(--st-text-secondary)]"
                                        aria-hidden="true"
                                    />
                                    Link expires
                                </span>
                            }
                            help="The link stops working after this time. Empty for no expiry."
                        >
                            <Input
                                id={idFor('expires')}
                                type="datetime-local"
                                value={expiresAt}
                                onChange={(e) => setExpiresAt(e.target.value)}
                            />
                        </Field>
                    </div>

                    {/* Max downloads (files only) */}
                    {!isFolder ? (
                        <div className="py-2.5">
                            <Field
                                id={idFor('max-downloads')}
                                label={
                                    <span className="inline-flex items-center justify-between gap-2">
                                        <span className="inline-flex items-center gap-1.5">
                                            <Download
                                                className="h-3.5 w-3.5 text-[var(--st-text-secondary)]"
                                                aria-hidden="true"
                                            />
                                            Max downloads
                                        </span>
                                        {node.shareDownloadCount != null ? (
                                            <span className="text-xs font-normal text-[var(--st-text-tertiary)]">
                                                {node.shareDownloadCount} used
                                            </span>
                                        ) : null}
                                    </span>
                                }
                                help="Auto-revoke after this many downloads. Empty for unlimited."
                            >
                                <Input
                                    id={idFor('max-downloads')}
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    step={1}
                                    value={maxDownloads}
                                    placeholder="Unlimited"
                                    onChange={(e) => setMaxDownloads(e.target.value)}
                                />
                            </Field>
                        </div>
                    ) : null}

                    {/* Max views (files only) */}
                    {!isFolder ? (
                        <div className="py-2.5">
                            <Field
                                id={idFor('max-views')}
                                label={
                                    <span className="inline-flex items-center justify-between gap-2">
                                        <span className="inline-flex items-center gap-1.5">
                                            <Eye
                                                className="h-3.5 w-3.5 text-[var(--st-text-secondary)]"
                                                aria-hidden="true"
                                            />
                                            Max views
                                        </span>
                                        {node.shareViewCount != null ? (
                                            <span className="text-xs font-normal text-[var(--st-text-tertiary)]">
                                                {node.shareViewCount} used
                                            </span>
                                        ) : null}
                                    </span>
                                }
                                help="Auto-revoke after this many previews. Empty for unlimited."
                            >
                                <Input
                                    id={idFor('max-views')}
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    step={1}
                                    value={maxViews}
                                    placeholder="Unlimited"
                                    onChange={(e) => setMaxViews(e.target.value)}
                                />
                            </Field>
                        </div>
                    ) : null}

                    {/* Watermark (files only) */}
                    {!isFolder ? (
                        <div className="py-2.5">
                            <ControlRow
                                label={
                                    <span className="inline-flex items-center gap-1.5">
                                        <Droplet
                                            className="h-3.5 w-3.5 text-[var(--st-text-secondary)]"
                                            aria-hidden="true"
                                        />
                                        Watermark preview
                                    </span>
                                }
                                htmlFor={idFor('watermark')}
                                hint="Tile a label across the preview"
                            >
                                <Switch
                                    id={idFor('watermark')}
                                    checked={watermarkOn}
                                    onCheckedChange={setWatermarkOn}
                                    aria-label="Watermark preview"
                                />
                            </ControlRow>

                            {watermarkOn ? (
                                <div className="mt-1 flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                                    <Field
                                        id={idFor('watermark-text')}
                                        label="Watermark text"
                                        help="Shown faintly, tiled across the preview"
                                    >
                                        <Input
                                            id={idFor('watermark-text')}
                                            type="text"
                                            value={watermarkText}
                                            placeholder="Confidential"
                                            onChange={(e) => setWatermarkText(e.target.value)}
                                        />
                                    </Field>

                                    <ControlRow
                                        label="Include viewer email"
                                        htmlFor={idFor('watermark-email')}
                                        hint="Stamp each viewer's email into the mark"
                                    >
                                        <Switch
                                            id={idFor('watermark-email')}
                                            checked={watermarkEmail}
                                            onCheckedChange={setWatermarkEmail}
                                            aria-label="Include viewer email in watermark"
                                        />
                                    </ControlRow>

                                    <Field
                                        id={idFor('watermark-opacity')}
                                        label="Opacity"
                                        help={`Faint (${MIN_WATERMARK_OPACITY}) to bold (${MAX_WATERMARK_OPACITY})`}
                                    >
                                        <Input
                                            id={idFor('watermark-opacity')}
                                            type="number"
                                            inputMode="decimal"
                                            min={MIN_WATERMARK_OPACITY}
                                            max={MAX_WATERMARK_OPACITY}
                                            step={0.05}
                                            value={watermarkOpacity}
                                            onChange={(e) => {
                                                const next = Number(e.target.value);
                                                setWatermarkOpacity(
                                                    Number.isFinite(next) ? next : DEFAULT_WATERMARK_OPACITY,
                                                );
                                            }}
                                            onBlur={() => setWatermarkOpacity((o) => clampOpacity(o))}
                                        />
                                    </Field>
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {/* Audit log toggle */}
                    <ControlRow
                        label={
                            <span className="inline-flex items-center gap-1.5">
                                <ScrollText
                                    className="h-3.5 w-3.5 text-[var(--st-text-secondary)]"
                                    aria-hidden="true"
                                />
                                Record access (audit log)
                            </span>
                        }
                        htmlFor={idFor('audit')}
                        hint="Log each view and download"
                    >
                        <Switch
                            id={idFor('audit')}
                            checked={auditEnabled}
                            onCheckedChange={setAuditEnabled}
                            aria-label="Record access in the audit log"
                        />
                    </ControlRow>
                </div>
            ) : null}

            {/* Share URL + copy */}
            {hasToken && shareUrl ? (
                <div className="mt-3 flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2">
                    <Link2 className="h-4 w-4 shrink-0 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-xs text-[var(--st-text-secondary)]">{shareUrl}</span>
                    <IconButton
                        label={copied ? 'Link copied' : 'Copy share link'}
                        icon={Copy}
                        variant="ghost"
                        size="sm"
                        onClick={onCopy}
                    />
                </div>
            ) : null}

            {/* Primary actions */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm" iconLeft={Shield} loading={saving} disabled={busy} onClick={onSave}>
                    {saving ? 'Saving…' : 'Save protection'}
                </Button>
                {hasToken ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={ShieldOff}
                        loading={revoking}
                        disabled={busy}
                        onClick={onRevoke}
                    >
                        Revoke link
                    </Button>
                ) : null}
            </div>

            {/* Access log (collapsible) */}
            <div className="mt-4 border-t border-[var(--st-border)] pt-3">
                <button
                    type="button"
                    onClick={onToggleLog}
                    aria-expanded={logOpen}
                    aria-controls={logRegionId}
                    className="flex w-full items-center justify-between gap-2 text-sm font-medium text-[var(--st-text)]"
                >
                    <span className="inline-flex items-center gap-1.5">
                        <ScrollText className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                        View access log
                    </span>
                    <ChevronDown
                        className={`h-4 w-4 text-[var(--st-text-tertiary)] transition-transform duration-150 ease-out ${
                            logOpen ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                    />
                </button>

                {logOpen ? (
                    <div id={logRegionId} aria-busy={logLoading} className="mt-2">
                        {logLoading ? (
                            <div className="flex items-center gap-2 py-2 text-sm text-[var(--st-text-secondary)]">
                                <Spinner size="sm" label="Loading access log" />
                                <span>Loading access log…</span>
                            </div>
                        ) : entries.length === 0 ? (
                            <p className="py-2 text-sm text-[var(--st-text-tertiary)]">
                                {logLoaded
                                    ? 'No access recorded yet. Entries appear here once the link is opened.'
                                    : 'No access recorded yet.'}
                            </p>
                        ) : (
                            <ul className="flex flex-col divide-y divide-[var(--st-border)]">
                                {entries.map((entry, i) => (
                                    <li key={`${entry.at ?? 'na'}-${i}`} className="flex flex-col gap-0.5 py-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium text-[var(--st-text)]">
                                                {auditActionLabel(entry.action)}
                                            </span>
                                            <time className="text-xs text-[var(--st-text-tertiary)]">
                                                {formatAuditTime(entry.at)}
                                            </time>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--st-text-tertiary)]">
                                            {entry.ip ? <span>IP {entry.ip}</span> : null}
                                            {entry.ua ? (
                                                <span className="min-w-0 truncate" title={entry.ua}>
                                                    {truncateUa(entry.ua)}
                                                </span>
                                            ) : null}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default SabFileSecurityPanel;
