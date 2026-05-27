import * as React from 'react';
import {
    Label,
    Input,
    Select,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruSelectContent,
    ZoruSelectItem,
    Textarea,
    Badge,
} from '@/components/zoruui';
import { Button } from '@/components/zoruui';
import { SabFileUrlInput } from '@/components/sabfiles';
import { Loader2, Sparkles, Clock3, AlertCircle, ShieldAlert, Image as ImageIcon } from 'lucide-react';
import type { ProjectSettings } from '@/lib/rust-client/telegram-settings';
import { testTelegramBusinessHoursAction } from '@/app/actions/telegram-settings.actions';
import { ChipInput, NumberRow, SectionCard, SwitchRow } from './shared';
import { PARSE_MODES, IANA_TIMEZONES, WEEKDAYS } from '../constants';

export function DefaultsSection({
    settings,
    setSettings,
    onSave,
    saving,
}: {
    settings: ProjectSettings;
    setSettings: React.Dispatch<React.SetStateAction<ProjectSettings>>;
    onSave: () => void;
    saving: boolean;
}) {
    const d = settings.defaults;
    const update = <K extends keyof typeof d>(key: K, value: (typeof d)[K]) => {
        setSettings((prev) => ({ ...prev, defaults: { ...prev.defaults, [key]: value } }));
    };
    return (
        <SectionCard
            icon={Sparkles}
            title="Defaults"
            description="Applied to every outgoing message unless a bot overrides them."
            onSave={onSave}
            saving={saving}
        >
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                    <Label>Default language</Label>
                    <Input
                        value={d.languageCode}
                        onChange={(e) => update('languageCode', e.target.value)}
                        placeholder="en"
                    />
                </div>
                <div className="space-y-1">
                    <Label>Parse mode</Label>
                    <Select
                        value={d.parseMode}
                        onValueChange={(v) => update('parseMode', v)}
                    >
                        <ZoruSelectTrigger>
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {PARSE_MODES.map((m) => (
                                <ZoruSelectItem key={m.value} value={m.value}>
                                    {m.label}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </Select>
                </div>
                <div className="space-y-1 md:col-span-2">
                    <Label>Signature line</Label>
                    <Textarea
                        value={d.signatureLine ?? ''}
                        onChange={(e) => update('signatureLine', e.target.value)}
                        rows={2}
                        placeholder="— Acme Support"
                    />
                    <p className="text-xs text-zoru-fg/60">
                        Appended as a suffix to broadcasts and auto-replies.
                    </p>
                </div>
                <div className="space-y-2 md:col-span-2">
                    <SwitchRow
                        label="Disable web page preview"
                        value={d.disableWebPagePreview}
                        onChange={(v) => update('disableWebPagePreview', v)}
                    />
                    <SwitchRow
                        label="Send silently (disable notification)"
                        value={d.disableNotification}
                        onChange={(v) => update('disableNotification', v)}
                    />
                </div>
                <div className="md:col-span-2">
                    <ChipInput
                        label="Allowed languages"
                        values={d.allowedLanguages}
                        onChange={(v) => update('allowedLanguages', v)}
                        placeholder="Add language code"
                    />
                </div>
                <NumberRow
                    label="Max broadcast concurrency"
                    value={d.maxBroadcastConcurrency}
                    onChange={(v) => update('maxBroadcastConcurrency', v)}
                    min={1}
                />
                <NumberRow
                    label="Rate · per chat / sec"
                    value={d.defaultRateLimit.perChatPerSecond}
                    onChange={(v) =>
                        update('defaultRateLimit', {
                            ...d.defaultRateLimit,
                            perChatPerSecond: v,
                        })
                    }
                    min={1}
                />
                <NumberRow
                    label="Rate · per bot / sec"
                    value={d.defaultRateLimit.perBotPerSecond}
                    onChange={(v) =>
                        update('defaultRateLimit', {
                            ...d.defaultRateLimit,
                            perBotPerSecond: v,
                        })
                    }
                    min={1}
                />
                <NumberRow
                    label="Rate · per bot / min"
                    value={d.defaultRateLimit.perBotPerMinute}
                    onChange={(v) =>
                        update('defaultRateLimit', {
                            ...d.defaultRateLimit,
                            perBotPerMinute: v,
                        })
                    }
                    min={1}
                />
                <NumberRow
                    label="Retention · messages (days)"
                    value={d.retentionDays.messages}
                    onChange={(v) => update('retentionDays', { ...d.retentionDays, messages: v })}
                    min={1}
                />
                <NumberRow
                    label="Retention · deliveries (days)"
                    value={d.retentionDays.deliveries}
                    onChange={(v) =>
                        update('retentionDays', { ...d.retentionDays, deliveries: v })
                    }
                    min={1}
                />
                <NumberRow
                    label="Retention · webhook log (days)"
                    value={d.retentionDays.webhookLog}
                    onChange={(v) =>
                        update('retentionDays', { ...d.retentionDays, webhookLog: v })
                    }
                    min={1}
                />
                <NumberRow
                    label="Retention · sessions (days)"
                    value={d.retentionDays.sessions}
                    onChange={(v) => update('retentionDays', { ...d.retentionDays, sessions: v })}
                    min={1}
                />
            </div>
        </SectionCard>
    );
}

export function BusinessHoursSection({
    projectId,
    settings,
    setSettings,
    onSave,
    saving,
}: {
    projectId: string;
    settings: ProjectSettings;
    setSettings: React.Dispatch<React.SetStateAction<ProjectSettings>>;
    onSave: () => void;
    saving: boolean;
}) {
    const bh = settings.businessHours;
    const reply = bh.outOfHoursReply ?? { kind: 'noop', payload: {} };
    const update = <K extends keyof typeof bh>(key: K, value: (typeof bh)[K]) => {
        setSettings((prev) => ({
            ...prev,
            businessHours: { ...prev.businessHours, [key]: value },
        }));
    };
    const updateRow = (
        idx: number,
        patch: Partial<{ openHHMM: string; closeHHMM: string }>,
    ) => {
        const next = bh.schedule.slice();
        next[idx] = { ...next[idx], ...patch };
        update('schedule', next);
    };
    const ensureSchedule = () => {
        if (bh.schedule.length === 7) return bh.schedule;
        const map = new Map(bh.schedule.map((r) => [r.weekday, r]));
        return WEEKDAYS.map((_, i) =>
            map.get(i) ?? { weekday: i, openHHMM: '09:00', closeHHMM: '18:00' },
        );
    };
    const schedule = ensureSchedule();

    const [testAt, setTestAt] = React.useState<string>('');
    React.useEffect(() => {
        setTestAt(new Date().toISOString().slice(0, 16));
    }, []);

    const [testResult, setTestResult] = React.useState<boolean | null>(null);
    const [testing, setTesting] = React.useState(false);

    const runTest = async () => {
        if (!testAt) return;
        setTesting(true);
        const ts = new Date(testAt).toISOString();
        const res = await testTelegramBusinessHoursAction(projectId, { timestamp: ts });
        setTesting(false);
        setTestResult(res.within_business_hours);
    };

    const payloadValue =
        typeof (reply.payload as { text?: string } | undefined)?.text === 'string'
            ? (reply.payload as { text: string }).text
            : '';
    const mediaUrlValue =
        typeof (reply.payload as { mediaUrl?: string } | undefined)?.mediaUrl === 'string'
            ? (reply.payload as { mediaUrl: string }).mediaUrl
            : '';

    return (
        <SectionCard
            icon={Clock3}
            title="Business Hours"
            description="Hours when bots accept messages without falling through to the out-of-hours reply."
            onSave={onSave}
            saving={saving}
        >
            <div className="space-y-4">
                <div className="space-y-1">
                    <Label>Timezone</Label>
                    <Select
                        value={bh.timezone}
                        onValueChange={(v) => update('timezone', v)}
                    >
                        <ZoruSelectTrigger>
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {IANA_TIMEZONES.map((tz) => (
                                <ZoruSelectItem key={tz} value={tz}>
                                    {tz}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    {schedule.map((row, idx) => (
                        <div
                            key={row.weekday}
                            className="grid grid-cols-[60px,1fr,1fr] items-center gap-2"
                        >
                            <div className="text-sm font-medium">{WEEKDAYS[row.weekday]}</div>
                            <Input
                                type="time"
                                value={row.openHHMM}
                                onChange={(e) => updateRow(idx, { openHHMM: e.target.value })}
                            />
                            <Input
                                type="time"
                                value={row.closeHHMM}
                                onChange={(e) => updateRow(idx, { closeHHMM: e.target.value })}
                            />
                        </div>
                    ))}
                </div>

                <div className="space-y-3 rounded border border-zoru-line bg-zoru-bg p-3">
                    <div className="text-sm font-semibold">Out-of-hours reply</div>
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-1">
                            <Label>Kind</Label>
                            <Select
                                value={reply.kind}
                                onValueChange={(v) =>
                                    update('outOfHoursReply', { ...reply, kind: v })
                                }
                            >
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="noop">No reply</ZoruSelectItem>
                                    <ZoruSelectItem value="reply_text">Text reply</ZoruSelectItem>
                                    <ZoruSelectItem value="reply_media">Media reply</ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                        </div>
                        {reply.kind === 'reply_text' || reply.kind === 'reply_media' ? (
                            <div className="space-y-1 md:col-span-2">
                                <Label>Message</Label>
                                <Textarea
                                    value={payloadValue}
                                    rows={2}
                                    onChange={(e) =>
                                        update('outOfHoursReply', {
                                            ...reply,
                                            payload: {
                                                ...(typeof reply.payload === 'object'
                                                    ? (reply.payload as object)
                                                    : {}),
                                                text: e.target.value,
                                            },
                                        })
                                    }
                                />
                            </div>
                        ) : null}
                        {reply.kind === 'reply_media' ? (
                            <div className="space-y-1 md:col-span-3">
                                <Label className="flex items-center gap-1">
                                    <ImageIcon className="h-3 w-3" /> Media
                                </Label>
                                <SabFileUrlInput
                                    value={mediaUrlValue}
                                    accept="image"
                                    onChange={(value) =>
                                        update('outOfHoursReply', {
                                            ...reply,
                                            payload: {
                                                ...(typeof reply.payload === 'object'
                                                    ? (reply.payload as object)
                                                    : {}),
                                                mediaUrl: value,
                                            },
                                        })
                                    }
                                />
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="space-y-2 rounded border border-zoru-line bg-zoru-bg p-3">
                    <div className="text-sm font-semibold">Test business hours</div>
                    <div className="flex flex-wrap items-end gap-2">
                        <div className="space-y-1">
                            <Label>At</Label>
                            <Input
                                type="datetime-local"
                                value={testAt}
                                onChange={(e) => setTestAt(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" onClick={runTest} disabled={testing || !testAt}>
                            {testing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                            Run
                        </Button>
                        {testResult !== null ? (
                            <Badge variant={testResult ? 'success' : 'warning'}>
                                {testResult ? 'Within hours' : 'Out of hours'}
                            </Badge>
                        ) : null}
                    </div>
                </div>
            </div>
        </SectionCard>
    );
}

export function NotificationsSection({
    settings,
    setSettings,
    onSave,
    saving,
}: {
    settings: ProjectSettings;
    setSettings: React.Dispatch<React.SetStateAction<ProjectSettings>>;
    onSave: () => void;
    saving: boolean;
}) {
    const n = settings.notifications;
    const update = <K extends keyof typeof n>(key: K, value: (typeof n)[K]) => {
        setSettings((prev) => ({
            ...prev,
            notifications: { ...prev.notifications, [key]: value },
        }));
    };
    const slackOk =
        !n.slackWebhook ||
        /^https:\/\/hooks\.slack\.com\/services\//.test(n.slackWebhook);
    const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    return (
        <SectionCard
            icon={AlertCircle}
            title="Notifications"
            description="Where to send digests and alerts about Telegram activity."
            onSave={onSave}
            saving={saving}
        >
            <div className="grid gap-3 md:grid-cols-2">
                <SwitchRow
                    label="Daily digest"
                    description="A daily email summary of broadcasts and replies."
                    value={n.dailyDigest}
                    onChange={(v) => update('dailyDigest', v)}
                />
                <SwitchRow
                    label="Error alerts"
                    description="Immediate alerts on webhook or send failures."
                    value={n.errorAlerts}
                    onChange={(v) => update('errorAlerts', v)}
                />
                <div className="space-y-1 md:col-span-2">
                    <Label>Slack webhook URL</Label>
                    <Input
                        value={n.slackWebhook ?? ''}
                        onChange={(e) => update('slackWebhook', e.target.value)}
                        placeholder="https://hooks.slack.com/services/..."
                    />
                    {!slackOk ? (
                        <p className="text-xs text-zoru-ink">Must be a hooks.slack.com URL.</p>
                    ) : null}
                </div>
                <div className="md:col-span-2">
                    <ChipInput
                        label="Email recipients"
                        values={n.emailRecipients}
                        onChange={(v) => update('emailRecipients', v)}
                        placeholder="Add email"
                        validate={emailOk}
                    />
                </div>
            </div>
        </SectionCard>
    );
}

export function SecuritySection({
    settings,
    setSettings,
    onSave,
    saving,
}: {
    settings: ProjectSettings;
    setSettings: React.Dispatch<React.SetStateAction<ProjectSettings>>;
    onSave: () => void;
    saving: boolean;
}) {
    const s = settings.security;
    const update = <K extends keyof typeof s>(key: K, value: (typeof s)[K]) => {
        setSettings((prev) => ({ ...prev, security: { ...prev.security, [key]: value } }));
    };
    return (
        <SectionCard
            icon={ShieldAlert}
            title="Security"
            description="Webhook secret rotation, admin requirement, and IP allow-listing."
            onSave={onSave}
            saving={saving}
        >
            <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                    <Label>Rotate webhook secret every (days)</Label>
                    <Input
                        type="number"
                        min={0}
                        value={s.rotateWebhookSecretEveryDays ?? 0}
                        onChange={(e) =>
                            update(
                                'rotateWebhookSecretEveryDays',
                                Number(e.target.value) || null,
                            )
                        }
                    />
                    <p className="text-xs text-zoru-fg/60">0 = never auto-rotate.</p>
                </div>
                <SwitchRow
                    label="Require bot admin"
                    description="Auto-disable bots whose owner loses admin in the chat."
                    value={s.requireBotAdmin}
                    onChange={(v) => update('requireBotAdmin', v)}
                />
                <div className="md:col-span-2">
                    <ChipInput
                        label="IP allowlist"
                        values={s.ipAllowlist}
                        onChange={(v) => update('ipAllowlist', v)}
                        placeholder="Add IP / CIDR"
                    />
                </div>
            </div>
        </SectionCard>
    );
}
