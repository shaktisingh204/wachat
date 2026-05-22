'use client';

import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  Skeleton,
  Switch,
  Textarea,
} from '@/components/zoruui';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Heart,
  Loader2,
  Plus,
  RefreshCw,
  RotateCw,
  Save,
  Trash2,
  Unlink,
  X,
  } from 'lucide-react';

import * as React from 'react';

import { useToast } from '@/hooks/use-toast';
import {
    disconnectTelegramBot,
    refreshTelegramWebhookInfo,
    rotateTelegramWebhookSecret,
} from '@/app/actions/telegram.actions';
import {
    deleteTelegramBotCommandsAction,
    getTelegramBotAdminRightsAction,
    getTelegramBotAction,
    getTelegramBotCommandsScopedAction,
    getTelegramBotInfoAction,
    getTelegramBotMenuButtonAction,
    runTelegramBotHealthAction,
    setTelegramBotAdminRightsAction,
    setTelegramBotCommandsScopedAction,
    setTelegramBotDescriptionAction,
    setTelegramBotMenuButtonAction,
    setTelegramBotNameAction,
    setTelegramBotShortDescriptionAction,
} from '@/app/actions/telegram-extra.actions';
import type {
    AdminRightsDto,
    BotCommand,
    BotRow,
    MenuButton,
} from '@/lib/rust-client/telegram-bots';

type Section =
    | 'overview'
    | 'commands'
    | 'profile'
    | 'menu'
    | 'webhook'
    | 'admin';

const SECTIONS: Array<{ id: Section; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'commands', label: 'Commands' },
    { id: 'profile', label: 'Profile' },
    { id: 'menu', label: 'Menu button' },
    { id: 'webhook', label: 'Webhook' },
    { id: 'admin', label: 'Admin rights' },
];

interface DrawerProps {
    botId: string | null;
    projectId: string | null;
    onOpenChange: (open: boolean) => void;
    onMutated: () => void;
}

export function BotDetailDrawer({
    botId,
    projectId,
    onOpenChange,
    onMutated,
}: DrawerProps) {
    const open = !!botId;
    const [section, setSection] = React.useState<Section>('overview');
    const [bot, setBot] = React.useState<BotRow | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const { toast } = useToast();

    const reload = React.useCallback(async () => {
        if (!botId) return;
        setLoading(true);
        setLoadError(null);
        try {
            const res = await getTelegramBotAction(botId);
            if (res.bot) {
                setBot(res.bot);
            } else {
                setBot(null);
                setLoadError(res.error ?? 'Bot not found.');
            }
        } catch (e) {
            setBot(null);
            setLoadError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [botId]);

    React.useEffect(() => {
        if (open) {
            setSection('overview');
            setBot(null);
            setLoadError(null);
            reload();
        }
    }, [open, reload]);

    function mutated() {
        onMutated();
        reload();
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <ZoruSheetContent
                side="right"
                className="flex w-full max-w-[640px] flex-col gap-0 p-0 sm:max-w-[640px]"
            >
                <ZoruSheetHeader className="border-b border-zoru-line p-6">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl text-base font-semibold text-white"
                            style={{
                                background:
                                    'linear-gradient(135deg, #229ED9 0%, #1A7FA8 100%)',
                            }}
                            aria-hidden
                        >
                            {(bot?.name || bot?.username || '?')
                                .charAt(0)
                                .toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <ZoruSheetTitle className="truncate text-left text-[16px]">
                                {bot?.name || bot?.username || 'Bot'}
                            </ZoruSheetTitle>
                            <ZoruSheetDescription className="text-left">
                                {bot?.username ? (
                                    <a
                                        href={`https://t.me/${bot.username}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[12px] text-zoru-ink-muted hover:underline"
                                    >
                                        @{bot.username}
                                        <ExternalLink className="h-3 w-3" aria-hidden />
                                    </a>
                                ) : loading ? (
                                    'Loading…'
                                ) : (
                                    <span className="text-[12px] text-zoru-ink-muted">
                                        Bot details unavailable
                                    </span>
                                )}
                            </ZoruSheetDescription>
                        </div>
                    </div>
                    <nav
                        className="mt-4 flex flex-wrap gap-1"
                        aria-label="Bot detail sections"
                    >
                        {SECTIONS.map((s) => {
                            const active = section === s.id;
                            return (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => setSection(s.id)}
                                    className={
                                        'rounded-full px-3 py-1 text-[12px] transition ' +
                                        (active
                                            ? 'bg-zoru-ink text-zoru-bg'
                                            : 'border border-zoru-line text-zoru-ink-muted hover:border-zoru-line-strong')
                                    }
                                    aria-current={active ? 'page' : undefined}
                                >
                                    {s.label}
                                </button>
                            );
                        })}
                    </nav>
                </ZoruSheetHeader>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col gap-3">
                            <Skeleton className="h-8 w-1/2" />
                            <Skeleton className="h-6 w-3/4" />
                            <Skeleton className="h-32 w-full" />
                        </div>
                    ) : !bot ? (
                        <div className="flex flex-col items-start gap-3 rounded-lg border border-zoru-danger-line bg-zoru-danger-bg p-4 text-[12.5px] text-zoru-danger-ink">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                                <div className="flex flex-col gap-1">
                                    <p className="font-medium">Could not load bot</p>
                                    <p className="text-[12px]">
                                        {loadError ??
                                            'The Telegram backend did not return a bot for this id.'}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={reload}
                            >
                                <RefreshCw className="h-3 w-3" aria-hidden />
                                Retry
                            </Button>
                        </div>
                    ) : section === 'overview' ? (
                        <OverviewPanel bot={bot} onRefresh={mutated} toast={toast} />
                    ) : section === 'commands' ? (
                        <CommandsPanel
                            bot={bot}
                            projectId={projectId}
                            toast={toast}
                            onMutated={mutated}
                        />
                    ) : section === 'profile' ? (
                        <ProfilePanel
                            bot={bot}
                            projectId={projectId}
                            toast={toast}
                            onMutated={mutated}
                        />
                    ) : section === 'menu' ? (
                        <MenuButtonPanel
                            bot={bot}
                            projectId={projectId}
                            toast={toast}
                        />
                    ) : section === 'webhook' ? (
                        <WebhookPanel
                            bot={bot}
                            toast={toast}
                            onMutated={mutated}
                            onClose={() => onOpenChange(false)}
                        />
                    ) : (
                        <AdminRightsPanel
                            bot={bot}
                            projectId={projectId}
                            toast={toast}
                        />
                    )}
                </div>
            </ZoruSheetContent>
        </Sheet>
    );
}

// =========================================================================
//  Overview panel
// =========================================================================

type PanelToast = ReturnType<typeof useToast>['toast'];

function OverviewPanel({
    bot,
    onRefresh,
    toast,
}: {
    bot: BotRow;
    onRefresh: () => void;
    toast: PanelToast;
}) {
    const [busy, setBusy] = React.useState<'info' | 'health' | null>(null);

    async function refreshInfo() {
        setBusy('info');
        const res = await getTelegramBotInfoAction(bot._id);
        setBusy(null);
        if (res.error) {
            toast({
                title: 'Refresh failed',
                description: res.error,
                variant: 'destructive',
            });
        } else {
            toast({ title: 'Bot info refreshed' });
            onRefresh();
        }
    }

    async function runHealth() {
        setBusy('health');
        const res = await runTelegramBotHealthAction(bot._id);
        setBusy(null);
        if (res.success) {
            toast({
                title: 'Bot is healthy',
                description: `Latency ${res.latencyMs ?? '—'}ms`,
            });
            onRefresh();
        } else {
            toast({
                title: 'Health check failed',
                description: res.error ?? 'Telegram did not respond.',
                variant: 'destructive',
            });
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshInfo}
                    disabled={busy !== null}
                >
                    {busy === 'info' ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                        <RefreshCw className="h-3 w-3" aria-hidden />
                    )}
                    Refresh from Telegram
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={runHealth}
                    disabled={busy !== null}
                >
                    {busy === 'health' ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                        <Heart className="h-3 w-3" aria-hidden />
                    )}
                    Health check
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Status" value={<StatusInline status={bot.status} />} />
                <Field label="Telegram ID" value={bot.botId.toString()} />
                <Field label="Username" value={bot.username ? `@${bot.username}` : '—'} />
                <Field
                    label="Latency"
                    value={typeof bot.latencyMs === 'number' ? `${bot.latencyMs} ms` : '—'}
                />
                <Field
                    label="Last seen"
                    value={bot.lastSeenAt ? new Date(bot.lastSeenAt).toLocaleString() : '—'}
                />
                <Field
                    label="Connected"
                    value={new Date(bot.createdAt).toLocaleString()}
                />
            </div>

            <Separator />

            <div>
                <h3 className="text-[13px] font-medium text-zoru-ink">Capabilities</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                    <Capability
                        label="Joins groups"
                        on={!!bot.canJoinGroups}
                    />
                    <Capability
                        label="Reads group messages"
                        on={!!bot.canReadAllGroupMessages}
                    />
                    <Capability
                        label="Inline queries"
                        on={!!bot.supportsInlineQueries}
                    />
                    <Capability
                        label="Main web app"
                        on={!!bot.hasMainWebApp}
                    />
                </div>
            </div>
        </div>
    );
}

function StatusInline({ status }: { status: BotRow['status'] }) {
    if (status === 'active')
        return (
            <Badge variant="success">
                <CheckCircle2 className="h-3 w-3" aria-hidden /> Active
            </Badge>
        );
    if (status === 'error')
        return (
            <Badge variant="danger">
                <AlertTriangle className="h-3 w-3" aria-hidden /> Error
            </Badge>
        );
    return (
        <Badge variant="ghost">
            <Unlink className="h-3 w-3" aria-hidden /> Disconnected
        </Badge>
    );
}

function Field({
    label,
    value,
}: {
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-0.5 rounded-lg border border-zoru-line bg-zoru-surface-2 px-3 py-2">
            <span className="text-[10.5px] uppercase tracking-[0.1em] text-zoru-ink-subtle">
                {label}
            </span>
            <span className="text-[13px] text-zoru-ink">{value}</span>
        </div>
    );
}

function Capability({ label, on }: { label: string; on: boolean }) {
    return (
        <Badge variant={on ? 'success' : 'ghost'}>
            {on ? (
                <CheckCircle2 className="h-3 w-3" aria-hidden />
            ) : (
                <X className="h-3 w-3" aria-hidden />
            )}
            {label}
        </Badge>
    );
}

// =========================================================================
//  Commands panel
// =========================================================================

function CommandsPanel({
    bot,
    projectId,
    toast,
    onMutated,
}: {
    bot: BotRow;
    projectId: string | null;
    toast: PanelToast;
    onMutated: () => void;
}) {
    const [commands, setCommands] = React.useState<BotCommand[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [clearing, setClearing] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            const res = await getTelegramBotCommandsScopedAction(bot._id);
            if (cancelled) return;
            setCommands(res.commands ?? []);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [bot._id]);

    function update(idx: number, patch: Partial<BotCommand>) {
        setCommands((prev) =>
            prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
        );
    }

    function add() {
        setCommands((prev) => [...prev, { command: '', description: '' }]);
    }

    function remove(idx: number) {
        setCommands((prev) => prev.filter((_, i) => i !== idx));
    }

    function validate(): string | null {
        for (const c of commands) {
            if (!/^[a-z0-9_]{1,32}$/.test(c.command)) {
                return 'Each command must be 1–32 chars (lowercase letters, digits, underscore).';
            }
            if (!c.description.trim() || c.description.length > 256) {
                return 'Descriptions must be 1–256 chars.';
            }
        }
        return null;
    }

    async function save() {
        if (!projectId) return;
        const err = validate();
        if (err) {
            toast({
                title: 'Invalid commands',
                description: err,
                variant: 'destructive',
            });
            return;
        }
        setSaving(true);
        const res = await setTelegramBotCommandsScopedAction({
            botId: bot._id,
            projectId,
            commands,
        });
        setSaving(false);
        if (res.success) {
            toast({ title: 'Commands pushed to Telegram' });
            onMutated();
        } else {
            toast({
                title: 'Save failed',
                description: res.error ?? 'Could not push commands.',
                variant: 'destructive',
            });
        }
    }

    async function clearAll() {
        if (!projectId) return;
        setClearing(true);
        const res = await deleteTelegramBotCommandsAction({
            botId: bot._id,
            projectId,
        });
        setClearing(false);
        if (res.success) {
            setCommands([]);
            toast({ title: 'Commands cleared' });
            onMutated();
        } else {
            toast({
                title: 'Clear failed',
                description: res.error ?? 'Could not clear commands.',
                variant: 'destructive',
            });
        }
    }

    return (
        <div className="flex flex-col gap-3">
            {loading ? (
                <Skeleton className="h-40 w-full" />
            ) : (
                <>
                    {commands.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-zoru-line bg-zoru-surface-2 p-6 text-center text-[12.5px] text-zoru-ink-muted">
                            No commands configured. Add one below — Telegram users will see
                            them in the chat menu.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {commands.map((c, idx) => (
                                <div
                                    key={idx}
                                    className="flex flex-wrap items-end gap-2 rounded-lg border border-zoru-line p-3"
                                >
                                    <div className="flex flex-col gap-1">
                                        <Label className="text-[10.5px] uppercase tracking-[0.1em]">
                                            Command
                                        </Label>
                                        <Input
                                            value={c.command}
                                            onChange={(e) =>
                                                update(idx, {
                                                    command: e.target.value
                                                        .toLowerCase()
                                                        .replace(/[^a-z0-9_]/g, ''),
                                                })
                                            }
                                            placeholder="start"
                                            className="w-40"
                                        />
                                    </div>
                                    <div className="flex flex-1 flex-col gap-1">
                                        <Label className="text-[10.5px] uppercase tracking-[0.1em]">
                                            Description
                                        </Label>
                                        <Input
                                            value={c.description}
                                            onChange={(e) =>
                                                update(idx, { description: e.target.value })
                                            }
                                            placeholder="Start the bot"
                                        />
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => remove(idx)}
                                        aria-label="Remove command"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                        <Button variant="outline" size="sm" onClick={add}>
                            <Plus className="h-3 w-3" aria-hidden /> Add command
                        </Button>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={clearAll}
                                disabled={clearing || saving}
                            >
                                {clearing ? (
                                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                                ) : null}
                                Clear all
                            </Button>
                            <Button
                                size="sm"
                                onClick={save}
                                disabled={saving || clearing}
                            >
                                {saving ? (
                                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                                ) : (
                                    <Save className="h-3 w-3" aria-hidden />
                                )}
                                Push to Telegram
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// =========================================================================
//  Profile panel — name / description / short description per language
// =========================================================================

function ProfilePanel({
    bot,
    projectId,
    toast,
    onMutated,
}: {
    bot: BotRow;
    projectId: string | null;
    toast: PanelToast;
    onMutated: () => void;
}) {
    const [name, setName] = React.useState(bot.name);
    const [description, setDescription] = React.useState('');
    const [shortDescription, setShortDescription] = React.useState('');
    const [languageCode, setLanguageCode] = React.useState('');
    const [busy, setBusy] = React.useState<'name' | 'desc' | 'short' | null>(null);

    async function saveName() {
        if (!projectId) return;
        setBusy('name');
        const res = await setTelegramBotNameAction({
            botId: bot._id,
            projectId,
            name,
            languageCode: languageCode || undefined,
        });
        setBusy(null);
        if (res.success) {
            toast({ title: 'Name updated' });
            onMutated();
        } else {
            toast({
                title: 'Update failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }

    async function saveDescription() {
        if (!projectId) return;
        setBusy('desc');
        const res = await setTelegramBotDescriptionAction({
            botId: bot._id,
            projectId,
            description,
            languageCode: languageCode || undefined,
        });
        setBusy(null);
        if (res.success) {
            toast({ title: 'Description updated' });
        } else {
            toast({
                title: 'Update failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }

    async function saveShort() {
        if (!projectId) return;
        setBusy('short');
        const res = await setTelegramBotShortDescriptionAction({
            botId: bot._id,
            projectId,
            shortDescription,
            languageCode: languageCode || undefined,
        });
        setBusy(null);
        if (res.success) {
            toast({ title: 'Short description updated' });
        } else {
            toast({
                title: 'Update failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <Label className="text-[10.5px] uppercase tracking-[0.1em]">
                    Language code
                </Label>
                <Input
                    value={languageCode}
                    onChange={(e) =>
                        setLanguageCode(e.target.value.toLowerCase().slice(0, 5))
                    }
                    placeholder="leave empty for default"
                    className="max-w-[160px]"
                />
                <p className="text-[11.5px] text-zoru-ink-muted">
                    Two-letter ISO 639-1 code (e.g. <code>en</code>, <code>es</code>) — leave
                    blank to set the default profile.
                </p>
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5">
                <Label className="text-[10.5px] uppercase tracking-[0.1em]">
                    Name (1–64 chars)
                </Label>
                <div className="flex gap-2">
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value.slice(0, 64))}
                        placeholder="My Bot"
                    />
                    <Button
                        size="sm"
                        onClick={saveName}
                        disabled={busy !== null}
                    >
                        {busy === 'name' ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        ) : (
                            <Save className="h-3 w-3" aria-hidden />
                        )}
                        Save
                    </Button>
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label className="text-[10.5px] uppercase tracking-[0.1em]">
                    Description (0–512 chars)
                </Label>
                <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 512))}
                    rows={4}
                    placeholder="Shown on the bot’s profile page."
                />
                <div className="flex justify-end">
                    <Button
                        size="sm"
                        onClick={saveDescription}
                        disabled={busy !== null}
                    >
                        {busy === 'desc' ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        ) : (
                            <Save className="h-3 w-3" aria-hidden />
                        )}
                        Save description
                    </Button>
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label className="text-[10.5px] uppercase tracking-[0.1em]">
                    Short description (0–120 chars)
                </Label>
                <Textarea
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value.slice(0, 120))}
                    rows={2}
                    placeholder="Shown on the bot’s share preview card."
                />
                <div className="flex justify-end">
                    <Button
                        size="sm"
                        onClick={saveShort}
                        disabled={busy !== null}
                    >
                        {busy === 'short' ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        ) : (
                            <Save className="h-3 w-3" aria-hidden />
                        )}
                        Save short description
                    </Button>
                </div>
            </div>
        </div>
    );
}

// =========================================================================
//  Menu button panel
// =========================================================================

type MenuType = 'default' | 'commands' | 'web_app';

function MenuButtonPanel({
    bot,
    projectId,
    toast,
}: {
    bot: BotRow;
    projectId: string | null;
    toast: PanelToast;
}) {
    const [type, setType] = React.useState<MenuType>('default');
    const [text, setText] = React.useState('Open app');
    const [url, setUrl] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            const res = await getTelegramBotMenuButtonAction(bot._id);
            if (cancelled) return;
            const mb = (res.menuButton ?? {}) as Record<string, unknown>;
            const t = (mb.type as string) || 'default';
            if (t === 'web_app') {
                setType('web_app');
                setText((mb.text as string) ?? 'Open app');
                const wa = (mb.web_app ?? {}) as { url?: string };
                setUrl(wa.url ?? '');
            } else if (t === 'commands') {
                setType('commands');
            } else {
                setType('default');
            }
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [bot._id]);

    async function save() {
        if (!projectId) return;
        let menuButton: MenuButton;
        if (type === 'web_app') {
            if (!/^https:\/\//.test(url)) {
                toast({
                    title: 'Invalid URL',
                    description: 'Web app URL must start with https://',
                    variant: 'destructive',
                });
                return;
            }
            menuButton = { type: 'web_app', text: text.slice(0, 64), web_app: { url } };
        } else if (type === 'commands') {
            menuButton = { type: 'commands' };
        } else {
            menuButton = { type: 'default' };
        }
        setSaving(true);
        const res = await setTelegramBotMenuButtonAction({
            botId: bot._id,
            projectId,
            menuButton,
        });
        setSaving(false);
        if (res.success) {
            toast({ title: 'Menu button updated' });
        } else {
            toast({
                title: 'Update failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }

    if (loading) return <Skeleton className="h-40 w-full" />;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <Label className="text-[10.5px] uppercase tracking-[0.1em]">
                    Menu type
                </Label>
                <Select value={type} onValueChange={(v) => setType(v as MenuType)}>
                    <ZoruSelectTrigger>
                        <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="default">Default</ZoruSelectItem>
                        <ZoruSelectItem value="commands">Commands list</ZoruSelectItem>
                        <ZoruSelectItem value="web_app">Web app</ZoruSelectItem>
                    </ZoruSelectContent>
                </Select>
            </div>

            {type === 'web_app' ? (
                <>
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10.5px] uppercase tracking-[0.1em]">
                            Button text
                        </Label>
                        <Input
                            value={text}
                            onChange={(e) => setText(e.target.value.slice(0, 64))}
                            placeholder="Open app"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10.5px] uppercase tracking-[0.1em]">
                            Web app URL (https://)
                        </Label>
                        <Input
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com/mini-app"
                            inputMode="url"
                        />
                    </div>
                </>
            ) : null}

            <Separator />
            <div className="rounded-lg border border-zoru-line bg-zoru-surface-2 p-4">
                <p className="text-[11.5px] uppercase tracking-[0.1em] text-zoru-ink-subtle">
                    Preview
                </p>
                <div className="mt-2 flex items-center justify-between">
                    <span className="text-[13px] text-zoru-ink">
                        {type === 'web_app'
                            ? text || 'Open app'
                            : type === 'commands'
                              ? 'Commands'
                              : 'Menu'}
                    </span>
                    <span className="text-[11.5px] text-zoru-ink-muted">
                        {type === 'web_app' ? 'Web app' : type}
                    </span>
                </div>
            </div>

            <div className="flex justify-end">
                <Button size="sm" onClick={save} disabled={saving}>
                    {saving ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                        <Save className="h-3 w-3" aria-hidden />
                    )}
                    Save menu button
                </Button>
            </div>
        </div>
    );
}

// =========================================================================
//  Webhook panel
// =========================================================================

function WebhookPanel({
    bot,
    toast,
    onMutated,
    onClose,
}: {
    bot: BotRow;
    toast: PanelToast;
    onMutated: () => void;
    onClose: () => void;
}) {
    const [busy, setBusy] = React.useState<'refresh' | 'rotate' | 'disconnect' | null>(
        null,
    );

    async function refresh() {
        setBusy('refresh');
        const res = await refreshTelegramWebhookInfo(bot._id);
        setBusy(null);
        if (res.success) {
            toast({ title: 'Webhook refreshed' });
            onMutated();
        } else {
            toast({
                title: 'Refresh failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }

    async function rotate() {
        setBusy('rotate');
        const res = await rotateTelegramWebhookSecret(bot._id);
        setBusy(null);
        if (res.success) {
            toast({ title: 'Webhook secret rotated' });
            onMutated();
        } else {
            toast({
                title: 'Rotate failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }

    async function disconnect() {
        setBusy('disconnect');
        const res = await disconnectTelegramBot(bot._id);
        setBusy(null);
        if (res.success) {
            toast({ title: 'Bot disconnected' });
            onMutated();
            onClose();
        } else {
            toast({
                title: 'Disconnect failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }

    const info = bot.webhookInfo;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <span className="text-[10.5px] uppercase tracking-[0.1em] text-zoru-ink-subtle">
                    Webhook URL
                </span>
                <code className="block truncate rounded-lg border border-zoru-line bg-zoru-surface-2 px-3 py-2 font-mono text-[12px] text-zoru-ink">
                    {bot.webhookUrl ?? 'Not registered'}
                </code>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field
                    label="Pending updates"
                    value={info?.pendingUpdateCount?.toString() ?? '—'}
                />
                <Field
                    label="Max connections"
                    value={info?.maxConnections?.toString() ?? '—'}
                />
                <Field label="IP address" value={info?.ipAddress ?? '—'} />
                <Field
                    label="Custom cert"
                    value={info?.hasCustomCertificate ? 'Yes' : 'No'}
                />
            </div>

            {info?.allowedUpdates?.length ? (
                <div>
                    <span className="text-[10.5px] uppercase tracking-[0.1em] text-zoru-ink-subtle">
                        Allowed updates
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                        {info.allowedUpdates.map((u) => (
                            <Badge key={u} variant="ghost">
                                {u}
                            </Badge>
                        ))}
                    </div>
                </div>
            ) : null}

            {info?.lastErrorMessage ? (
                <div className="rounded-lg border border-zoru-danger-line bg-zoru-danger-bg p-3 text-[12.5px] text-zoru-danger-ink">
                    <p className="font-medium">Last error</p>
                    <p className="mt-1">{info.lastErrorMessage}</p>
                    {info.lastErrorDate ? (
                        <p className="mt-1 text-[11.5px]">
                            {new Date(info.lastErrorDate).toLocaleString()}
                        </p>
                    ) : null}
                </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={refresh}
                    disabled={busy !== null}
                >
                    {busy === 'refresh' ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                        <RefreshCw className="h-3 w-3" aria-hidden />
                    )}
                    Refresh
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={rotate}
                    disabled={busy !== null}
                >
                    {busy === 'rotate' ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                        <RotateCw className="h-3 w-3" aria-hidden />
                    )}
                    Rotate secret
                </Button>
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={disconnect}
                    disabled={busy !== null}
                >
                    {busy === 'disconnect' ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                        <Unlink className="h-3 w-3" aria-hidden />
                    )}
                    Disconnect bot
                </Button>
            </div>
        </div>
    );
}

// =========================================================================
//  Admin rights panel
// =========================================================================

const GROUP_FIELDS: Array<{ key: keyof AdminRightsDto; label: string }> = [
    { key: 'isAnonymous', label: 'Anonymous' },
    { key: 'canManageChat', label: 'Manage chat' },
    { key: 'canDeleteMessages', label: 'Delete messages' },
    { key: 'canManageVideoChats', label: 'Manage video chats' },
    { key: 'canRestrictMembers', label: 'Restrict members' },
    { key: 'canPromoteMembers', label: 'Promote members' },
    { key: 'canChangeInfo', label: 'Change info' },
    { key: 'canInviteUsers', label: 'Invite users' },
    { key: 'canPinMessages', label: 'Pin messages' },
    { key: 'canManageTopics', label: 'Manage topics' },
];

const CHANNEL_FIELDS: Array<{ key: keyof AdminRightsDto; label: string }> = [
    { key: 'isAnonymous', label: 'Anonymous' },
    { key: 'canManageChat', label: 'Manage chat' },
    { key: 'canDeleteMessages', label: 'Delete messages' },
    { key: 'canRestrictMembers', label: 'Restrict members' },
    { key: 'canPromoteMembers', label: 'Promote members' },
    { key: 'canChangeInfo', label: 'Change info' },
    { key: 'canInviteUsers', label: 'Invite users' },
    { key: 'canPostMessages', label: 'Post messages' },
    { key: 'canEditMessages', label: 'Edit messages' },
    { key: 'canPostStories', label: 'Post stories' },
    { key: 'canEditStories', label: 'Edit stories' },
    { key: 'canDeleteStories', label: 'Delete stories' },
];

function emptyRights(): AdminRightsDto {
    return {
        isAnonymous: false,
        canManageChat: false,
        canDeleteMessages: false,
        canManageVideoChats: false,
        canRestrictMembers: false,
        canPromoteMembers: false,
        canChangeInfo: false,
        canInviteUsers: false,
    };
}

function AdminRightsPanel({
    bot,
    projectId,
    toast,
}: {
    bot: BotRow;
    projectId: string | null;
    toast: PanelToast;
}) {
    const [forChannels, setForChannels] = React.useState(false);
    const [rights, setRights] = React.useState<AdminRightsDto>(emptyRights());
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            const res = await getTelegramBotAdminRightsAction(bot._id, forChannels);
            if (cancelled) return;
            setRights(res.rights ?? emptyRights());
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [bot._id, forChannels]);

    function toggle(key: keyof AdminRightsDto, value: boolean) {
        setRights((prev) => ({ ...prev, [key]: value }));
    }

    async function save() {
        if (!projectId) return;
        setSaving(true);
        const res = await setTelegramBotAdminRightsAction({
            botId: bot._id,
            projectId,
            forChannels,
            rights,
        });
        setSaving(false);
        if (res.success) {
            toast({ title: 'Default rights updated' });
        } else {
            toast({
                title: 'Update failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }

    const fields = forChannels ? CHANNEL_FIELDS : GROUP_FIELDS;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <Label className="text-[10.5px] uppercase tracking-[0.1em]">
                    Scope
                </Label>
                <Select
                    value={forChannels ? 'channel' : 'group'}
                    onValueChange={(v) => setForChannels(v === 'channel')}
                >
                    <ZoruSelectTrigger className="max-w-[200px]">
                        <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="group">Groups</ZoruSelectItem>
                        <ZoruSelectItem value="channel">Channels</ZoruSelectItem>
                    </ZoruSelectContent>
                </Select>
            </div>

            {loading ? (
                <Skeleton className="h-60 w-full" />
            ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {fields.map((f) => (
                        <label
                            key={f.key as string}
                            className="flex items-center justify-between gap-3 rounded-lg border border-zoru-line bg-zoru-surface-2 px-3 py-2"
                        >
                            <span className="text-[12.5px] text-zoru-ink">
                                {f.label}
                            </span>
                            <Switch
                                checked={!!rights[f.key]}
                                onCheckedChange={(v) => toggle(f.key, v)}
                                aria-label={f.label}
                            />
                        </label>
                    ))}
                </div>
            )}

            <div className="flex justify-end">
                <Button size="sm" onClick={save} disabled={saving}>
                    {saving ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                        <Save className="h-3 w-3" aria-hidden />
                    )}
                    Save default rights
                </Button>
            </div>
        </div>
    );
}
