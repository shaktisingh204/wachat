'use client';

import {
    Alert,
    Badge,
    Button,
    Card,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    EmptyState,
    Field,
    Input,
    PageActions,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    Switch,
    useToast,
    type BadgeTone,
} from '@/components/sabcrm/20ui';
import { useRouter } from 'next/navigation';
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
    Plug2,
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

// Local validation mirrors the Rust regexes. See
// `rust/crates/telegram-api-credentials/src/handlers.rs`.
const API_HASH_RE = /^[A-Fa-f0-9]{32}$/;
const PHONE_RE = /^\+[1-9][0-9]{6,14}$/;

const STATUS_TONE: Record<string, BadgeTone> = {
    unverified: 'neutral',
    verified: 'info',
    login_pending: 'warning',
    login_failed: 'danger',
    active: 'success',
    revoked: 'neutral',
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
        // 404 here means the Rust BFF route isn't deployed yet, which
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
        // Same treatment as bots list. Swallow 404s, surface real errors.
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
                tone: 'success',
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
            <PageHeader>
                <div className="flex items-start gap-4">
                    <span
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#37BBFE_0%,#007DBB_100%)] shadow-[0_10px_28px_rgba(0,125,187,0.25)]"
                        aria-hidden="true"
                    >
                        <Plug className="h-6 w-6 text-white" strokeWidth={1.75} />
                    </span>
                    <PageHeaderHeading>
                        <PageTitle>Connections</PageTitle>
                        <PageDescription>
                            Link a Telegram Bot (for standard messaging) or MTProto
                            user credentials (for full client-level automation).
                        </PageDescription>
                        {activeProject ? (
                            <p className="mt-1 text-[12px] text-[var(--st-text-secondary)]">
                                Working in{' '}
                                <span className="font-medium text-[var(--st-text)]">
                                    {activeProject.name}
                                </span>
                            </p>
                        ) : null}
                    </PageHeaderHeading>
                </div>
                <PageActions>
                    <Link
                        href={`/dashboard/telegram/projects?next=${encodeURIComponent('/dashboard/telegram/connections')}`}
                        className="shrink-0"
                    >
                        <Button variant="outline" size="sm" iconRight={ArrowRight}>
                            {activeProject ? 'Switch project' : 'Pick a project'}
                        </Button>
                    </Link>
                </PageActions>
            </PageHeader>

            {/* No-project banner replaces the silent disabled state. */}
            {!projectId ? (
                <Alert tone="info" icon={Info} title="Select a project first">
                    Connections are scoped per project. Bots, webhooks, and chats
                    belong to the active workspace.
                    <div className="mt-2">
                        <Link
                            href="/dashboard/telegram/projects?next=/dashboard/telegram/connections"
                            className="inline-flex items-center gap-1 text-[var(--st-accent)] underline underline-offset-2"
                        >
                            Choose a Telegram project{' '}
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                    </div>
                </Alert>
            ) : null}

            {/* Bot connection */}
            <Card padding="lg">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] text-[var(--st-text)]">Bot API</h2>
                            <Badge tone="neutral">Recommended</Badge>
                        </div>
                        <p className="mt-1 text-[12.5px] text-[var(--st-text-secondary)]">
                            Create a bot with @BotFather and paste the token below.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        iconRight={ExternalLink}
                        onClick={() =>
                            window.open(
                                'https://t.me/BotFather',
                                '_blank',
                                'noopener,noreferrer',
                            )
                        }
                    >
                        Open BotFather
                    </Button>
                </div>
                <div className="mt-5 flex flex-col gap-4">
                    <Field label="Bot token">
                        <Input
                            placeholder="123456789:AA-Example-TokenFromBotFather"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            type="password"
                            disabled={!projectId}
                        />
                    </Field>
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
                                iconLeft={copiedKey === 'placeholder' ? Check : Copy}
                                onClick={() =>
                                    copy(placeholderWebhookUrl, 'placeholder')
                                }
                            >
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
                        loading={submitting}
                        disabled={!token.trim() || !projectId}
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
                                    tone: 'success',
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
                        Connect bot
                    </Button>
                </div>
            </Card>

            {/* Connected bots, visible right where you connect them. */}
            <Card padding="lg">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] text-[var(--st-text)]">
                                Connected bots
                            </h2>
                            <Badge tone="neutral">
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
                            iconLeft={botsLoading ? Loader2 : RefreshCw}
                            onClick={() => void reloadBots()}
                            disabled={botsLoading || !projectId}
                        >
                            Refresh
                        </Button>
                        <Link
                            href="/dashboard/telegram/bots"
                            className="inline-flex items-center gap-1 text-[12px] text-[var(--st-accent)] hover:underline"
                        >
                            Manage bots
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                    </div>
                </div>

                <div className="mt-4">
                    {!projectId ? (
                        <EmptyState
                            icon={Plug2}
                            size="sm"
                            title="No project selected"
                            description="Pick a project to see its connected bots."
                        />
                    ) : botsLoading ? (
                        <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
                            <Loader2
                                className="h-3 w-3 animate-spin"
                                aria-hidden="true"
                            />{' '}
                            Loading bots...
                        </div>
                    ) : botsError ? (
                        <p className="text-[12.5px] text-[var(--st-danger)]">
                            {botsError}
                        </p>
                    ) : bots.length === 0 ? (
                        <EmptyState
                            icon={Plug2}
                            size="sm"
                            title="No bots linked yet"
                            description="Paste a token above to connect one."
                        />
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
                                                        tone={
                                                            b.status === 'active'
                                                                ? 'success'
                                                                : b.status === 'error'
                                                                ? 'danger'
                                                                : 'neutral'
                                                        }
                                                    >
                                                        {b.status}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                loading={isBusy}
                                                iconLeft={Unlink}
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
                                                            tone: 'success',
                                                        });
                                                        void reloadBots();
                                                    } else {
                                                        toast({
                                                            title: 'Disconnect failed',
                                                            description:
                                                                res.error ??
                                                                'Unknown error.',
                                                            tone: 'danger',
                                                        });
                                                    }
                                                }}
                                            >
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
                                                iconLeft={isCopied ? Check : Copy}
                                                onClick={() => copy(url, b._id)}
                                            >
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

            {/* MTProto / Client API, wired to telegram-api-credentials */}
            <Card padding="lg">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] text-[var(--st-text)]">
                                Client API (MTProto)
                            </h2>
                            <Badge tone="neutral">Advanced</Badge>
                            <Badge tone="warning">Preview</Badge>
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
                            iconRight={ExternalLink}
                            onClick={() =>
                                window.open(
                                    'https://my.telegram.org',
                                    '_blank',
                                    'noopener,noreferrer',
                                )
                            }
                        >
                            my.telegram.org
                        </Button>
                        <Link
                            href="/dashboard/telegram/api-credentials"
                            className="inline-flex items-center gap-1 text-[12px] text-[var(--st-accent)] hover:underline"
                        >
                            Manage credentials
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                    </div>
                </div>

                {/* Preview note */}
                <Alert
                    tone="warning"
                    icon={AlertTriangle}
                    className="mt-4"
                >
                    The MTProto login flow is in preview. Credentials saved here are
                    stored and audited; a future MTProto worker will perform the real
                    Telegram handshake.
                </Alert>

                {/* Existing credentials for the active project */}
                <div className="mt-5">
                    {credsLoading ? (
                        <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text-secondary)]">
                            <Loader2
                                className="h-3 w-3 animate-spin"
                                aria-hidden="true"
                            />{' '}
                            Loading credentials...
                        </div>
                    ) : credsError ? (
                        <p className="text-[12.5px] text-[var(--st-danger)]">
                            {credsError}
                        </p>
                    ) : credentials.length === 0 ? (
                        <EmptyState
                            icon={KeyRound}
                            size="sm"
                            title="No MTProto credentials yet"
                            description="Click Add credentials to store an api_id / api_hash pair."
                        />
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {credentials.map((c) => (
                                <li
                                    key={c._id}
                                    className="flex items-center justify-between rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <KeyRound
                                                className="h-3 w-3 text-[var(--st-text-secondary)]"
                                                aria-hidden="true"
                                            />
                                            <span className="truncate text-[13px] text-[var(--st-text)]">
                                                {c.label ?? (
                                                    <span className="italic text-[var(--st-text-secondary)]">
                                                        unnamed
                                                    </span>
                                                )}
                                            </span>
                                            <Badge tone={STATUS_TONE[c.status] ?? 'neutral'}>
                                                {STATUS_LABEL[c.status] ?? c.status}
                                            </Badge>
                                        </div>
                                        <p className="mt-0.5 font-mono text-[11.5px] text-[var(--st-text-secondary)]">
                                            api_id={c.apiId} . {c.phoneNumberMasked} .{' '}
                                            {c.apiHashMasked}
                                        </p>
                                    </div>
                                    <Link
                                        href="/dashboard/telegram/api-credentials"
                                        className="text-[12px] text-[var(--st-accent)] hover:underline"
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
                        iconRight={ArrowRight}
                        onClick={() =>
                            router.push('/dashboard/telegram/api-credentials')
                        }
                    >
                        Manage all
                    </Button>
                    <Button
                        size="sm"
                        iconLeft={Plus}
                        onClick={() => {
                            setAddErr(null);
                            setAddOpen(true);
                        }}
                        disabled={!projectId}
                    >
                        Add credentials
                    </Button>
                </div>
            </Card>

            {/* Add credentials dialog, inline shortcut from the connections page. */}
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
                        <Field label="Label (optional)">
                            <Input
                                value={addLabel}
                                onChange={(e) => setAddLabel(e.target.value)}
                                placeholder="e.g. main user account"
                            />
                        </Field>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="api_id">
                                <Input
                                    inputMode="numeric"
                                    value={apiId}
                                    placeholder="1234567"
                                    onChange={(e) => setApiId(e.target.value)}
                                />
                            </Field>
                            <Field label="Phone number (E.164)">
                                <Input
                                    value={phoneNumber}
                                    placeholder="+14155552671"
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                />
                            </Field>
                        </div>
                        <Field label="api_hash">
                            <Input
                                type="password"
                                value={apiHash}
                                placeholder="32-character hex string"
                                onChange={(e) => setApiHash(e.target.value)}
                            />
                        </Field>
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--st-border)] px-3 py-2">
                            <div>
                                <p className="text-[12.5px] text-[var(--st-text)]">
                                    Test mode
                                </p>
                                <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                                    Route through Telegram's test DC pair.
                                </p>
                            </div>
                            <Switch
                                checked={testMode}
                                onCheckedChange={(v) => setTestMode(!!v)}
                                aria-label="Test mode"
                            />
                        </div>
                        {addErr ? (
                            <Alert tone="danger">{addErr}</Alert>
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
                            loading={addBusy}
                            onClick={saveNewCredentials}
                        >
                            Save & open
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
