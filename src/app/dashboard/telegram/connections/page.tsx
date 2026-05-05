'use client';

import * as React from 'react';
import { Plug, Copy, Check, ExternalLink, Loader2 } from 'lucide-react';
import { ZoruBadge, ZoruButton, ZoruCard, ZoruInput } from '@/components/zoruui';
import { connectTelegramBot } from '@/app/actions/telegram.actions';
import { useProject } from '@/context/project-context';

export default function TelegramConnectionsPage() {
    const { activeProject } = useProject();
    const [token, setToken] = React.useState('');
    const [apiId, setApiId] = React.useState('');
    const [apiHash, setApiHash] = React.useState('');
    const [copied, setCopied] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [status, setStatus] = React.useState<{ kind: 'ok' | 'err'; message: string } | null>(null);

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

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-start gap-4">
                <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                        background: 'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)',
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
                        Link a Telegram Bot (for standard messaging) or MTProto user credentials
                        (for full client-level automation).
                    </p>
                </div>
            </div>

            {/* Bot connection */}
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
                            window.open('https://t.me/BotFather', '_blank', 'noopener,noreferrer')
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
                            <ZoruButton
                                variant="outline"
                                size="sm"
                                onClick={copyWebhook}
                            >
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
                            status.kind === 'ok' ? 'text-zoru-success-ink' : 'text-zoru-danger-ink'
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
                                setStatus({ kind: 'err', message: 'Select a project first.' });
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
                                setStatus({ kind: 'ok', message: res.message ?? 'Bot connected.' });
                            } else {
                                setStatus({ kind: 'err', message: res.error ?? 'Failed to connect.' });
                            }
                        }}
                    >
                        {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        Connect bot
                    </ZoruButton>
                </div>
            </ZoruCard>

            {/* MTProto / Client API */}
            <ZoruCard className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] text-zoru-ink">
                                Client API (MTProto)
                            </h2>
                            <ZoruBadge variant="ghost">Advanced</ZoruBadge>
                        </div>
                        <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
                            Needed for user-account automation: reading channel history, bulk imports,
                            large file transfers, group calls.
                        </p>
                    </div>
                    <ZoruButton
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            window.open('https://my.telegram.org', '_blank', 'noopener,noreferrer')
                        }
                    >
                        my.telegram.org
                        <ExternalLink className="h-3 w-3" />
                    </ZoruButton>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-[11.5px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                            api_id
                        </span>
                        <ZoruInput
                            placeholder="1234567"
                            value={apiId}
                            onChange={(e) => setApiId(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-[11.5px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                            api_hash
                        </span>
                        <ZoruInput
                            placeholder="32-character hex string"
                            value={apiHash}
                            onChange={(e) => setApiHash(e.target.value)}
                            type="password"
                        />
                    </label>
                </div>
                <div className="mt-5 flex justify-end">
                    <ZoruButton
                        size="sm"
                        disabled={!apiId.trim() || !apiHash.trim()}
                    >
                        Start login flow
                    </ZoruButton>
                </div>
            </ZoruCard>
        </div>
    );
}
