'use client';

import { Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Switch, useToast } from '@/components/sabcrm/20ui';
import {
  useRouter } from 'next/navigation';
import {
    AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Info,
  KeyRound,
  Loader2,
  Plug,
  Plus,
  RefreshCw,
  Unlink,
  } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import {
    connectTelegramBot,
    disconnectTelegramBot,
} from '@/app/actions/telegram.actions';
import { listTelegramBotsAction } from '@/app/actions/telegram-extra.actions';
import type { BotRow } from '@/lib/rust-client/telegram-bots';
import {
    createTelegramApiCredentialAction,
    listTelegramApiCredentialsAction,
} from '@/app/actions/telegram-api-credentials.actions';
import { useProject } from '@/context/project-context';
import type { CredentialRow } from '@/lib/rust-client/telegram-api-credentials';

// Local validation mirrors the Rust regexes — see
// `rust/crates/telegram-api-credentials/src/handlers.rs`.
const API_HASH_RE = /^[A-Fa-f0-9]{32}$/;
const PHONE_RE = /^\+[1-9][0-9]{6,14}$/;

const STATUS_VARIANT: Record<
    string,
    'success' | 'warning' | 'ghost' | 'info' | 'secondary' | 'danger'
> = {
    unverified: 'ghost',
    verified: 'info',
    login_pending: 'warning',
    login_failed: 'danger',
    active: 'success',
    revoked: 'secondary',
};
const STATUS_LABEL: Record<string, string> = {
    unverified: 'Unverified',
    verified: 'Verified',
    login_pending: 'Login pending',
    login_failed: 'Login failed',
    active: 'Active',
    revoked: 'Revoked',
};

export default function TelegramConnectionsPage() {
    const { activeProject } = useProject();
    const router = useRouter();
    const { toast } = useToast();

    const projectId = activeProject?._id?.toString() ?? '';

    // ---------------- Bot section ----------------
    const [token, setToken] = React.useState('');
    const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
    const [submitting, setSubmitting] = React.useState(false);
    const [status, setStatus] = React.useState<{
        kind: 'ok' | 'err';
        message: string;
    } | null>(null);

    const [origin, setOrigin] = React.useState('');
    React.useEffect(() => {
        setOrigin(window.location.origin);
    }, []);
    const placeholderWebhookUrl = `${origin || 'https://your-app'}/api/telegram/webhook/<bot-id>`;

    const copy = React.useCallback(async (text: string, key: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedKey(key);
            setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1800);
        } catch {
            /* clipboard might be blocked */
        }
    }, []);

    // ---------------- Connected bots list ----------------
    const [bots, setBots] = React.useState<BotRow[]>([]);
    const [botsLoading, setBotsLoading] = React.useState(true);
    const [botsError, setBotsError] = React.useState<string | null>(null);
    const [disconnectingId, setDisconnectingId] = React.useState<string | null>(null);

    const reloadBots = React.useCallback(async () => {
        if (!projectId) {
            setBots([]);
            setBotsLoading(false);
            return;
        }
        setBotsLoading(true);
        setBotsError(null);
        const res = await listTelegramBotsAction({ projectId });
        setBots(res.bots ?? []);
        // 404 here means the Rust BFF route isn't deployed yet — that
        // shouldn't surface as a red error banner. Anything else (auth,
        // 500) is worth showing.
        if (res.error && !/404|not found/i.test(res.error)) {
            setBotsError(res.error);
        }
        setBotsLoading(false);
    }, [projectId]);

    React.useEffect(() => {
        void reloadBots();
    }, [reloadBots]);

    // ---------------- MTProto credentials section ----------------
    const [credentials, setCredentials] = React.useState<CredentialRow[]>([]);
    const [credsLoading, setCredsLoading] = React.useState(true);
    const [credsError, setCredsError] = React.useState<string | null>(null);

    const [addOpen, setAddOpen] = React.useState(false);
    const [addLabel, setAddLabel] = React.useState('');
    const [apiId, setApiId] = React.useState('');
    const [apiHash, setApiHash] = React.useState('');
    const [phoneNumber, setPhoneNumber] = React.useState('');
    const [testMode, setTestMode] = React.useState(false);
    const [addBusy, setAddBusy] = React.useState(false);
    const [addErr, setAddErr] = React.useState<string | null>(null);

    const reloadCredentials = React.useCallback(async () => {
        if (!projectId) {
            setCredentials([]);
            setCredsLoading(false);
            return;
        }
        setCredsLoading(true);
        setCredsError(null);
        const res = await listTelegramApiCredentialsAction(projectId);
        setCredentials(res.credentials ?? []);
        setCredsLoading(false);
        // Same treatment as bots list — swallow 404s, surface real errors.
        if (res.error && !/404|not found/i.test(res.error)) {
            setCredsError(res.error);
        }
    }, [projectId]);

    React.useEffect(() => {
        void reloadCredentials();
    }, [reloadCredentials]);

    function validateNewCreds(): string | null {
        const idNum = Number(apiId.trim());
        if (!Number.isInteger(idNum) || idNum <= 0) {
            return 'api_id must be a positive integer.';
        }
        if (!API_HASH_RE.test(apiHash.trim())) {
            return 'api_hash must be exactly 32 hex characters.';
        }
        if (!PHONE_RE.test(phoneNumber.trim())) {
            return 'phoneNumber must be E.164 (e.g. +14155552671).';
        }
        return null;
    }

    async function saveNewCredentials() {
        if (!projectId) {
            setAddErr('Select a project first.');
            return;
        }
        const msg = validateNewCreds();
        if (msg) {
            setAddErr(msg);
            return;
        }
        setAddErr(null);
        setAddBusy(true);
        const res = await createTelegramApiCredentialAction({
            projectId,
            label: addLabel.trim() || undefined,
            apiId: Number(apiId.trim()),
            apiHash: apiHash.trim().toLowerCase(),
            phoneNumber: phoneNumber.trim(),
            testMode,
        });
        setAddBusy(false);
        if (res.success) {
            toast({
                title: 'Credentials saved',
                description:
                    res.message ?? 'Stored. The MTProto login flow is in preview.',
            });
            setAddOpen(false);
            setAddLabel('');
            setApiId('');
            setApiHash('');
            setPhoneNumber('');
            setTestMode(false);
            void reloadCredentials();
            // Navigate to the dedicated page so the user can run "Start login".
            router.push('/dashboard/telegram/api-credentials');
        } else {
            setAddErr(res.error ?? 'Failed to save credentials.');
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                        style={{
                            background:
                                'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)',
                            boxShadow: '0 10px 28px rgba(0, 125, 187, 0.25)',
                        }}
                    >
                        <Plug className="h-6 w-6 text-white" strokeWidth={1.75} />
                    </div>
                    <div>
                        <h1 className="text-[22px] leading-tight text-[var(--st-text)]">
                            Connections
                        </h1>
                        <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-[var(--st-text-secondary)]">
                            Link a Telegram Bot (for standard messaging) or MTProto user
                            credentials (for full client-level automation).
                        </p>
                        {activeProject ? (
                            <p className="mt-1 text-[12px] text-[var(--st-text-secondary)]">
                                Working in{' '}
                                <span className="font-medium text-[var(--st-text)]">
                                    {activeProject.name}
                                </span>
                            </p>
                        ) : null}
                    </div>
                </div>
                <Link
                    href={`/dashboard/telegram/projects?next=${encodeURIComponent('/dashboard/telegram/connections')}`}
                    className="shrink-0"
                >
                    <Button variant="outline" size="sm">
                        {activeProject ? 'Switch project' : 'Pick a project'}
                        <ArrowRight className="h-3 w-3" />
                    </Button>
                </Link>
            </div>

            {/* No-project banner — replaces the silent disabled state. */}
            {!projectId ? (
                <div
                    className="flex items-start gap-3 rounded-2xl border p-4"
                    style={{ borderColor: 'var(--st-border)', background: 'var(--st-bg-muted)' }}
                >
                    <Info className="mt-0.5 h-4 w-4 text-[var(--st-text)]" />
                    <div className="flex-1 text-[12.5px] leading-relaxed text-[var(--st-text)]">
                        Select a project before connecting a bot. Connections are
                        scoped per project — bots, webhooks, and chats belong to the
                        active workspace.
                        <div className="mt-2">
                            <Link
                                href="/dashboard/telegram/projects?next=/dashboard/telegram/connections"
                                className="inline-flex items-center gap-1 text-[var(--st-text)] underline underline-offset-2"
                            >
                                Choose a Telegram project{' '}
                                <ArrowRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Bot connection */}
            <Card className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] text-[var(--st-text)]">Bot API</h2>
                            <Badge variant="ghost">Recommended</Badge>
                        </div>
                        <p className="mt-1 text-[12.5px] text-[var(--st-text-secondary)]">
                            Create a bot with @BotFather and paste the token below.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            window.open(
                                'https://t.me/BotFather',
                                '_blank',
                                'noopener,noreferrer',
                            )
                        }
                    >
                        Open BotFather
                        <ExternalLink className="h-3 w-3" />
                    </Button>
                </div>
                <div className="mt-5 flex flex-col gap-4">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-[11.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                            Bot token
                        </span>
                        <Input
                            placeholder="123456789:AA-Example-TokenFromBotFather"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            type="password"
                            disabled={!projectId}
                        />
                    </label>
                    <div>
                        <p className="mb-1.5 text-[11.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                            Webhook URL preview
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 truncate rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 font-mono text-[12px] text-[var(--st-text)]">
                                {placeholderWebhookUrl}
                            </code>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    copy(placeholderWebhookUrl, 'placeholder')
                                }
                            >
                                {copiedKey === 'placeholder' ? (
                                    <Check className="h-3 w-3" />
                                ) : (
                                    <Copy className="h-3 w-3" />
                                )}
                                {copiedKey === 'placeholder' ? 'Copied' : 'Copy'}
                            </Button>
                        </div>
                        <p className="mt-1.5 text-[11.5px] text-[var(--st-text-secondary)]">
                            The real bot id is filled in automatically after you click
                            Connect bot. We register the webhook with Telegram on your
                            behalf.
                        </p>
                    </div>
                </div>
                {status ? (
                    <p
                        className={`mt-4 text-[12.5px] ${
                            status.kind === 'ok'
                                ? 'text-[var(--st-status-ok)]'
                                : 'text-[var(--st-danger)]'
                        }`}
                    >
                        {status.message}
                    </p>
                ) : null}
                <div className="mt-5 flex justify-end gap-2">
                    <Button
                        size="sm"
                        disabled={!token.trim() || submitting || !projectId}
                        onClick={async () => {
                            if (!projectId) {
                                setStatus({
                                    kind: 'err',
                                    message: 'Select a project first.',
                                });
                                return;
                            }
                            setSubmitting(true);
                            setStatus(null);
                            const res = await connectTelegramBot({
                                projectId,
                                token: token.trim(),
                            });
                            setSubmitting(false);
                            if (res.success) {
                                setToken('');
                                setStatus({
                                    kind: 'ok',
                                    message: res.message ?? 'Bot connected.',
                                });
                                toast({
                                    title: 'Bot connected',
                                    description: res.message ?? 'Webhook registered.',
                                });
                                void reloadBots();
                            } else {
                                setStatus({
                                    kind: 'err',
                                    message: res.error ?? 'Failed to connect.',
                                });
                            }
                        }}
                    >
                        {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        Connect bot
                    </Button>
                </div>
            </Card>

            {/* Connected bots — visible right where you connect them. */}
            <Card className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] text-[var(--st-text)]">
                                Connected bots
                            </h2>
                            <Badge variant="ghost">
                                {bots.length === 0
                                    ? 'None yet'
                                    : `${bots.length} active`}
                            </Badge>
                        </div>
                        <p className="mt-1 text-[12.5px] text-[var(--st-text-secondary)]">
                            Bots linked to this project. The webhook URL below is the
                            real one Telegram delivers updates to.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void reloadBots()}
                            disabled={botsLoading || !projectId}
                        >
                            {botsLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <RefreshCw className="h-3 w-3" />
                            )}
                            Refresh
                        </Button>
                        <Link
                            href="/dashboard/telegram/bots"
                            className="text-[12px] text-[var(--st-text)] hover:underline"
                        >
                            <span className="inline-flex items-center gap-1">
                                Manage bots <ArrowRight className="h-3 w-3" />
                            </span>
                        </Link>
                    </div>
                </div>

                <div className="mt-4">
                    {!projectId ? (
                        <div className="rounded-xl border border-dashed border-[var(--st-border)] p-4 text-[12.5px] text-[var(--st-text-secondary)]">
                            Pick a project to see its connected bots.
                        </div>
                    ) : botsLoading ? (
                        <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading bots…
                        </div>
                    ) : botsError ? (
                        <p className="text-[12.5px] text-[var(--st-danger)]">
                            {botsError}
                        </p>
                    ) : bots.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[var(--st-border)] p-4 text-[12.5px] text-[var(--st-text-secondary)]">
                            No bots linked yet. Paste a token above to connect one.
                        </div>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {bots.map((b) => {
                                const url =
                                    b.webhookUrl ||
                                    `${origin || 'https://your-app'}/api/telegram/webhook/${b._id}`;
                                const isCopied = copiedKey === b._id;
                                const isBusy = disconnectingId === b._id;
                                return (
                                    <li
                                        key={b._id}
                                        className="flex flex-col gap-2 rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-3"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="truncate text-[13px] text-[var(--st-text)]">
                                                        {b.name}
                                                    </span>
                                                    <span className="font-mono text-[11.5px] text-[var(--st-text-secondary)]">
                                                        @{b.username}
                                                    </span>
                                                    <Badge
                                                        variant={
                                                            b.status === 'active'
                                                                ? 'success'
                                                                : b.status === 'error'
                                                                ? 'danger'
                                                                : 'secondary'
                                                        }
                                                    >
                                                        {b.status}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={isBusy}
                                                onClick={async () => {
                                                    if (
                                                        !window.confirm(
                                                            `Disconnect @${b.username}? Telegram will stop delivering updates to this webhook.`,
                                                        )
                                                    )
                                                        return;
                                                    setDisconnectingId(b._id);
                                                    const res =
                                                        await disconnectTelegramBot(
                                                            b._id,
                                                        );
                                                    setDisconnectingId(null);
                                                    if (res.success) {
                                                        toast({
                                                            title: 'Bot disconnected',
                                                            description:
                                                                res.message ??
                                                                'Webhook removed.',
                                                        });
                                                        void reloadBots();
                                                    } else {
                                                        toast({
                                                            title: 'Disconnect failed',
                                                            description:
                                                                res.error ??
                                                                'Unknown error.',
                                                            variant: 'destructive',
                                                        });
                                                    }
                                                }}
                                            >
                                                {isBusy ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Unlink className="h-3 w-3" />
                                                )}
                                                Disconnect
                                            </Button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 truncate rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-1.5 font-mono text-[11.5px] text-[var(--st-text)]">
                                                {url}
                                            </code>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => copy(url, b._id)}
                                            >
                                                {isCopied ? (
                                                    <Check className="h-3 w-3" />
                                                ) : (
                                                    <Copy className="h-3 w-3" />
                                                )}
                                                {isCopied ? 'Copied' : 'Copy'}
                                            </Button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </Card>

            {/* MTProto / Client API — wired to telegram-api-credentials */}
            <Card className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] text-[var(--st-text)]">
                                Client API (MTProto)
                            </h2>
                            <Badge variant="ghost">Advanced</Badge>
                            <Badge variant="warning">Preview</Badge>
                        </div>
                        <p className="mt-1 max-w-2xl text-[12.5px] text-[var(--st-text-secondary)]">
                            Needed for user-account automation: reading channel history,
                            bulk imports, large file transfers, group calls. Credentials
                            are stored securely; live MTProto sessions are not yet
                            running.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                window.open(
                                    'https://my.telegram.org',
                                    '_blank',
                                    'noopener,noreferrer',
                                )
                            }
                        >
                            my.telegram.org
                            <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Link
                            href="/dashboard/telegram/api-credentials"
                            className="text-[12px] text-[var(--st-text)] hover:underline"
                        >
                            <span className="inline-flex items-center gap-1">
                                Manage credentials <ArrowRight className="h-3 w-3" />
                            </span>
                        </Link>
                    </div>
                </div>

                {/* Preview note */}
                <div
                    className="mt-4 flex items-start gap-3 rounded-2xl border p-3"
                    style={{ borderColor: 'var(--st-border)', background: 'var(--st-bg-muted)' }}
                >
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--st-text)]" />
                    <p className="text-[12.5px] leading-relaxed text-[var(--st-text)]">
                        The MTProto login flow is in preview. Credentials saved here are
                        stored and audited; a future MTProto worker will perform the
                        real Telegram handshake.
                    </p>
                </div>

                {/* Existing credentials for the active project */}
                <div className="mt-5">
                    {credsLoading ? (
                        <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading
                            credentials…
                        </div>
                    ) : credsError ? (
                        <p className="text-[12.5px] text-[var(--st-danger)]">
                            {credsError}
                        </p>
                    ) : credentials.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[var(--st-border)] p-4 text-[12.5px] text-[var(--st-text-secondary)]">
                            No MTProto credentials yet. Click <strong>Add credentials</strong>{' '}
                            to store an <code className="font-mono">api_id</code>/
                            <code className="font-mono">api_hash</code> pair.
                        </div>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {credentials.map((c) => (
                                <li
                                    key={c._id}
                                    className="flex items-center justify-between rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <KeyRound className="h-3 w-3 text-[var(--st-text-secondary)]" />
                                            <span className="truncate text-[13px] text-[var(--st-text)]">
                                                {c.label ?? (
                                                    <span className="italic text-[var(--st-text-secondary)]">
                                                        unnamed
                                                    </span>
                                                )}
                                            </span>
                                            <Badge
                                                variant={STATUS_VARIANT[c.status] ?? 'ghost'}
                                            >
                                                {STATUS_LABEL[c.status] ?? c.status}
                                            </Badge>
                                        </div>
                                        <p className="mt-0.5 font-mono text-[11.5px] text-[var(--st-text-secondary)]">
                                            api_id={c.apiId} · {c.phoneNumberMasked} ·{' '}
                                            {c.apiHashMasked}
                                        </p>
                                    </div>
                                    <Link
                                        href="/dashboard/telegram/api-credentials"
                                        className="text-[12px] text-[var(--st-text)] hover:underline"
                                    >
                                        Open
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="mt-5 flex justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            router.push('/dashboard/telegram/api-credentials')
                        }
                    >
                        Manage all
                        <ArrowRight className="h-3 w-3" />
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => {
                            setAddErr(null);
                            setAddOpen(true);
                        }}
                        disabled={!projectId}
                    >
                        <Plus className="h-3 w-3" />
                        Add credentials
                    </Button>
                </div>
            </Card>

            {/* Add credentials dialog — inline shortcut from the connections page. */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add MTProto credentials</DialogTitle>
                        <DialogDescription>
                            Saved values are encrypted at the database layer; the raw
                            api_hash is never returned by the API.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[11.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                                Label (optional)
                            </span>
                            <Input
                                value={addLabel}
                                onChange={(e) => setAddLabel(e.target.value)}
                                placeholder="e.g. main user account"
                            />
                        </label>
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[11.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                                    api_id
                                </span>
                                <Input
                                    inputMode="numeric"
                                    value={apiId}
                                    placeholder="1234567"
                                    onChange={(e) => setApiId(e.target.value)}
                                />
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[11.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                                    Phone number (E.164)
                                </span>
                                <Input
                                    value={phoneNumber}
                                    placeholder="+14155552671"
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                />
                            </label>
                        </div>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[11.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                                api_hash
                            </span>
                            <Input
                                type="password"
                                value={apiHash}
                                placeholder="32-character hex string"
                                onChange={(e) => setApiHash(e.target.value)}
                            />
                        </label>
                        <label className="flex items-center justify-between rounded-lg border border-[var(--st-border)] px-3 py-2">
                            <div>
                                <p className="text-[12.5px] text-[var(--st-text)]">Test mode</p>
                                <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                                    Route through Telegram's test DC pair.
                                </p>
                            </div>
                            <Switch
                                checked={testMode}
                                onCheckedChange={(v) => setTestMode(!!v)}
                            />
                        </label>
                        {addErr ? (
                            <div className="rounded-md border border-[var(--st-danger)] bg-[var(--st-danger-soft)] px-3 py-2 text-[12.5px] text-[var(--st-danger)]">
                                {addErr}
                            </div>
                        ) : null}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAddOpen(false)}
                            disabled={addBusy}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={saveNewCredentials}
                            disabled={addBusy}
                        >
                            {addBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            Save & open
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
