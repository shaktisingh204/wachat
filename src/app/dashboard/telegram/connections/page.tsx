'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ArrowRight,
    Check,
    Copy,
    ExternalLink,
    KeyRound,
    Loader2,
    Plug,
    Plus,
} from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruDialog,
    ZoruDialogContent,
    ZoruDialogDescription,
    ZoruDialogFooter,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruInput,
    ZoruSwitch,
    useZoruToast,
} from '@/components/zoruui';
import { connectTelegramBot } from '@/app/actions/telegram.actions';
import {
    createTelegramApiCredentialAction,
    listTelegramApiCredentialsAction,
} from '@/app/actions/telegram-api-credentials.actions';
import type { CredentialRow } from '@/app/actions/telegram-api-credentials.actions';
import { useProject } from '@/context/project-context';

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
    const { toast } = useZoruToast();

    const projectId = activeProject?._id?.toString() ?? '';

    // ---------------- Bot section (unchanged) ----------------
    const [token, setToken] = React.useState('');
    const [copied, setCopied] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [status, setStatus] = React.useState<{
        kind: 'ok' | 'err';
        message: string;
    } | null>(null);

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const webhookUrl = `${origin}/api/telegram/webhook/<bot-id>`;

    const copyWebhook = async () => {
        try {
            await navigator.clipboard.writeText(webhookUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            /* clipboard might be blocked */
        }
    };

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
        if (res.error) setCredsError(res.error);
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
                    <h1 className="text-[22px] leading-tight text-zoru-ink">
                        Connections
                    </h1>
                    <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-zoru-ink-muted">
                        Link a Telegram Bot (for standard messaging) or MTProto user
                        credentials (for full client-level automation).
                    </p>
                </div>
            </div>

            {/* Bot connection — unchanged */}
            <ZoruCard className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] text-zoru-ink">Bot API</h2>
                            <ZoruBadge variant="ghost">Recommended</ZoruBadge>
                        </div>
                        <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
                            Create a bot with @BotFather and paste the token below.
                        </p>
                    </div>
                    <ZoruButton
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
                    </ZoruButton>
                </div>
                <div className="mt-5 flex flex-col gap-4">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-[11.5px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                            Bot token
                        </span>
                        <ZoruInput
                            placeholder="123456789:AA-Example-TokenFromBotFather"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            type="password"
                        />
                    </label>
                    <div>
                        <p className="mb-1.5 text-[11.5px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                            Webhook URL
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 truncate rounded-lg border border-zoru-line bg-zoru-surface-2 px-3 py-2 font-mono text-[12px] text-zoru-ink">
                                {webhookUrl}
                            </code>
                            <ZoruButton variant="outline" size="sm" onClick={copyWebhook}>
                                {copied ? (
                                    <Check className="h-3 w-3" />
                                ) : (
                                    <Copy className="h-3 w-3" />
                                )}
                                {copied ? 'Copied' : 'Copy'}
                            </ZoruButton>
                        </div>
                    </div>
                </div>
                {status ? (
                    <p
                        className={`mt-4 text-[12.5px] ${
                            status.kind === 'ok'
                                ? 'text-zoru-success-ink'
                                : 'text-zoru-danger-ink'
                        }`}
                    >
                        {status.message}
                    </p>
                ) : null}
                <div className="mt-5 flex justify-end gap-2">
                    <ZoruButton
                        size="sm"
                        disabled={!token.trim() || submitting || !activeProject?._id}
                        onClick={async () => {
                            if (!activeProject?._id) {
                                setStatus({
                                    kind: 'err',
                                    message: 'Select a project first.',
                                });
                                return;
                            }
                            setSubmitting(true);
                            setStatus(null);
                            const res = await connectTelegramBot({
                                projectId: activeProject._id.toString(),
                                token: token.trim(),
                            });
                            setSubmitting(false);
                            if (res.success) {
                                setToken('');
                                setStatus({
                                    kind: 'ok',
                                    message: res.message ?? 'Bot connected.',
                                });
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
                    </ZoruButton>
                </div>
            </ZoruCard>

            {/* MTProto / Client API — wired to telegram-api-credentials */}
            <ZoruCard className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] text-zoru-ink">
                                Client API (MTProto)
                            </h2>
                            <ZoruBadge variant="ghost">Advanced</ZoruBadge>
                            <ZoruBadge variant="warning">Preview</ZoruBadge>
                        </div>
                        <p className="mt-1 max-w-2xl text-[12.5px] text-zoru-ink-muted">
                            Needed for user-account automation: reading channel history,
                            bulk imports, large file transfers, group calls. Credentials
                            are stored securely; live MTProto sessions are not yet
                            running.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <ZoruButton
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
                        </ZoruButton>
                        <Link
                            href="/dashboard/telegram/api-credentials"
                            className="text-[12px] text-zoru-ink hover:underline"
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
                    style={{ borderColor: '#F1C40F66', background: '#FEF6D7' }}
                >
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
                    <p className="text-[12.5px] leading-relaxed text-amber-900">
                        The MTProto login flow is in preview. Credentials saved here are
                        stored and audited; a future MTProto worker will perform the
                        real Telegram handshake.
                    </p>
                </div>

                {/* Existing credentials for the active project */}
                <div className="mt-5">
                    {credsLoading ? (
                        <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink-muted">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading
                            credentials…
                        </div>
                    ) : credsError ? (
                        <p className="text-[12.5px] text-zoru-danger-ink">
                            {credsError}
                        </p>
                    ) : credentials.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zoru-line p-4 text-[12.5px] text-zoru-ink-muted">
                            No MTProto credentials yet. Click <strong>Add credentials</strong>{' '}
                            to store an <code className="font-mono">api_id</code>/
                            <code className="font-mono">api_hash</code> pair.
                        </div>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {credentials.map((c) => (
                                <li
                                    key={c._id}
                                    className="flex items-center justify-between rounded-xl border border-zoru-line bg-zoru-surface-2 px-3 py-2"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <KeyRound className="h-3 w-3 text-zoru-ink-muted" />
                                            <span className="truncate text-[13px] text-zoru-ink">
                                                {c.label ?? (
                                                    <span className="italic text-zoru-ink-muted">
                                                        unnamed
                                                    </span>
                                                )}
                                            </span>
                                            <ZoruBadge
                                                variant={STATUS_VARIANT[c.status] ?? 'ghost'}
                                            >
                                                {STATUS_LABEL[c.status] ?? c.status}
                                            </ZoruBadge>
                                        </div>
                                        <p className="mt-0.5 font-mono text-[11.5px] text-zoru-ink-muted">
                                            api_id={c.apiId} · {c.phoneNumberMasked} ·{' '}
                                            {c.apiHashMasked}
                                        </p>
                                    </div>
                                    <Link
                                        href="/dashboard/telegram/api-credentials"
                                        className="text-[12px] text-zoru-ink hover:underline"
                                    >
                                        Open
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="mt-5 flex justify-end gap-2">
                    <ZoruButton
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            router.push('/dashboard/telegram/api-credentials')
                        }
                    >
                        Manage all
                        <ArrowRight className="h-3 w-3" />
                    </ZoruButton>
                    <ZoruButton
                        size="sm"
                        onClick={() => {
                            setAddErr(null);
                            setAddOpen(true);
                        }}
                        disabled={!projectId}
                    >
                        <Plus className="h-3 w-3" />
                        Add credentials
                    </ZoruButton>
                </div>
            </ZoruCard>

            {/* Add credentials dialog — inline shortcut from the connections page. */}
            <ZoruDialog open={addOpen} onOpenChange={setAddOpen}>
                <ZoruDialogContent className="max-w-lg">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Add MTProto credentials</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Saved values are encrypted at the database layer; the raw
                            api_hash is never returned by the API.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>

                    <div className="flex flex-col gap-4">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[11.5px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                                Label (optional)
                            </span>
                            <ZoruInput
                                value={addLabel}
                                onChange={(e) => setAddLabel(e.target.value)}
                                placeholder="e.g. main user account"
                            />
                        </label>
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[11.5px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                                    api_id
                                </span>
                                <ZoruInput
                                    inputMode="numeric"
                                    value={apiId}
                                    placeholder="1234567"
                                    onChange={(e) => setApiId(e.target.value)}
                                />
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[11.5px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                                    Phone number (E.164)
                                </span>
                                <ZoruInput
                                    value={phoneNumber}
                                    placeholder="+14155552671"
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                />
                            </label>
                        </div>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-[11.5px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                                api_hash
                            </span>
                            <ZoruInput
                                type="password"
                                value={apiHash}
                                placeholder="32-character hex string"
                                onChange={(e) => setApiHash(e.target.value)}
                            />
                        </label>
                        <label className="flex items-center justify-between rounded-lg border border-zoru-line px-3 py-2">
                            <div>
                                <p className="text-[12.5px] text-zoru-ink">Test mode</p>
                                <p className="text-[11.5px] text-zoru-ink-muted">
                                    Route through Telegram's test DC pair.
                                </p>
                            </div>
                            <ZoruSwitch
                                checked={testMode}
                                onCheckedChange={(v) => setTestMode(!!v)}
                            />
                        </label>
                        {addErr ? (
                            <div className="rounded-md border border-zoru-danger-line bg-zoru-danger-surface px-3 py-2 text-[12.5px] text-zoru-danger-ink">
                                {addErr}
                            </div>
                        ) : null}
                    </div>

                    <ZoruDialogFooter>
                        <ZoruButton
                            variant="outline"
                            size="sm"
                            onClick={() => setAddOpen(false)}
                            disabled={addBusy}
                        >
                            Cancel
                        </ZoruButton>
                        <ZoruButton
                            size="sm"
                            onClick={saveNewCredentials}
                            disabled={addBusy}
                        >
                            {addBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            Save & open
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>
        </div>
    );
}
