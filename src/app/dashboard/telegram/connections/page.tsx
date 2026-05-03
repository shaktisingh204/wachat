'use client';

import * as React from 'react';
import { Plug, Copy, Check, ExternalLink, Loader2 } from 'lucide-react';
import { ClayCard, ClayButton, ClayInput, ClayBadge } from '@/components/clay';
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
        <div className="flex flex-col gap-6 clay-enter">
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
                    <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-foreground">
                        Connections
                    </h1>
                    <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
                        Link a Telegram Bot (for standard messaging) or MTProto user credentials
                        (for full client-level automation).
                    </p>
                </div>
            </div>

            {/* Bot connection */}
            <ClayCard variant="default" padded>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] font-semibold text-foreground">Bot API</h2>
                            <ClayBadge tone="blue">Recommended</ClayBadge>
                        </div>
                        <p className="mt-1 text-[12.5px] text-muted-foreground">
                            Create a bot with @BotFather and paste the token below.
                        </p>
                    </div>
                    <ClayButton
                        variant="pill"
                        size="sm"
                        onClick={() =>
                            window.open('https://t.me/BotFather', '_blank', 'noopener,noreferrer')
                        }
                        trailing={<ExternalLink className="h-3 w-3" />}
                    >
                        Open BotFather
                    </ClayButton>
                </div>
                <div className="mt-5 flex flex-col gap-4">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            Bot token
                        </span>
                        <ClayInput
                            placeholder="123456789:AA-Example-TokenFromBotFather"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            type="password"
                        />
                    </label>
                    <div>
                        <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            Webhook URL
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 truncate rounded-lg border border-border bg-secondary px-3 py-2 font-mono text-[12px] text-foreground">
                                {webhookUrl}
                            </code>
                            <ClayButton
                                variant="pill"
                                size="sm"
                                onClick={copyWebhook}
                                leading={
                                    copied ? (
                                        <Check className="h-3 w-3" />
                                    ) : (
                                        <Copy className="h-3 w-3" />
                                    )
                                }
                            >
                                {copied ? 'Copied' : 'Copy'}
                            </ClayButton>
                        </div>
                    </div>
                </div>
                {status ? (
                    <p
                        className={`mt-4 text-[12.5px] ${
                            status.kind === 'ok' ? 'text-emerald-500' : 'text-destructive'
                        }`}
                    >
                        {status.message}
                    </p>
                ) : null}
                <div className="mt-5 flex justify-end gap-2">
                    <ClayButton
                        variant="obsidian"
                        size="sm"
                        disabled={!token.trim() || submitting || !activeProject?._id}
                        leading={submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : undefined}
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
                        Connect bot
                    </ClayButton>
                </div>
            </ClayCard>

            {/* MTProto / Client API */}
            <ClayCard variant="default" padded>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] font-semibold text-foreground">
                                Client API (MTProto)
                            </h2>
                            <ClayBadge tone="neutral">Advanced</ClayBadge>
                        </div>
                        <p className="mt-1 text-[12.5px] text-muted-foreground">
                            Needed for user-account automation: reading channel history, bulk imports,
                            large file transfers, group calls.
                        </p>
                    </div>
                    <ClayButton
                        variant="pill"
                        size="sm"
                        onClick={() =>
                            window.open('https://my.telegram.org', '_blank', 'noopener,noreferrer')
                        }
                        trailing={<ExternalLink className="h-3 w-3" />}
                    >
                        my.telegram.org
                    </ClayButton>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            api_id
                        </span>
                        <ClayInput
                            placeholder="1234567"
                            value={apiId}
                            onChange={(e) => setApiId(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            api_hash
                        </span>
                        <ClayInput
                            placeholder="32-character hex string"
                            value={apiHash}
                            onChange={(e) => setApiHash(e.target.value)}
                            type="password"
                        />
                    </label>
                </div>
                <div className="mt-5 flex justify-end">
                    <ClayButton
                        variant="obsidian"
                        size="sm"
                        disabled={!apiId.trim() || !apiHash.trim()}
                    >
                        Start login flow
                    </ClayButton>
                </div>
            </ClayCard>
        </div>
    );
}
