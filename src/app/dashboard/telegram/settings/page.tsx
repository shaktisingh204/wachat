'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Button,
  Card,
  ZoruCardContent,
  EmptyState,
  Input,
  Label,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Switch,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  AlertCircle,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  Globe2,
  Loader2,
  Settings,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserCog,
  Image as ImageIcon,
  X,
  } from 'lucide-react';

/**
 * Telegram Settings — project-level + per-bot policy layer.
 *
 * Sections (segmented, no tab UI):
 *  Defaults · Business Hours · Notifications · Security ·
 *  Per-bot Overrides · GDPR · Audit
 *
 * Backed by `/v1/telegram/settings` via the actions in
 * `src/app/actions/telegram-settings.actions.ts`.
 */

import * as React from 'react';

import { SabFileUrlInput } from '@/components/sabfiles';
import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';
import {
    clearTelegramBotOverridesAction,
    getTelegramBotOverridesAction,
    getTelegramProjectSettingsAction,
    listTelegramGdprRequestsAction,
    listTelegramSettingsAuditAction,
    requestTelegramDataDeletionAction,
    requestTelegramDataExportAction,
    saveTelegramBotOverridesAction,
    saveTelegramProjectSettingsAction,
    testTelegramBusinessHoursAction,
} from '@/app/actions/telegram-settings.actions';
import { listTelegramBots } from '@/app/actions/telegram.actions';
import type {
    AuditRow,
    GdprRequestRow,
    ProjectSettings,
} from '@/lib/rust-client/telegram-settings';

const ACCENT = '#229ED9';

const SECTIONS = [
    { id: 'defaults', label: 'Defaults', icon: Sparkles },
    { id: 'business-hours', label: 'Business Hours', icon: Clock3 },
    { id: 'notifications', label: 'Notifications', icon: AlertCircle },
    { id: 'security', label: 'Security', icon: ShieldAlert },
    { id: 'overrides', label: 'Per-bot Overrides', icon: UserCog },
    { id: 'gdpr', label: 'GDPR', icon: Globe2 },
    { id: 'audit', label: 'Audit', icon: ClipboardList },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

const PARSE_MODES = [
    { value: 'HTML', label: 'HTML' },
    { value: 'MarkdownV2', label: 'MarkdownV2' },
    { value: 'plain', label: 'Plain text' },
] as const;

const IANA_TIMEZONES = [
    'UTC', 'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
    'America/Anchorage', 'America/Argentina/Buenos_Aires', 'America/Bogota', 'America/Chicago',
    'America/Denver', 'America/Halifax', 'America/Lima', 'America/Los_Angeles', 'America/Mexico_City',
    'America/New_York', 'America/Phoenix', 'America/Sao_Paulo', 'America/Santiago',
    'America/Toronto', 'America/Vancouver', 'Asia/Bangkok', 'Asia/Dhaka', 'Asia/Dubai',
    'Asia/Ho_Chi_Minh', 'Asia/Hong_Kong', 'Asia/Jakarta', 'Asia/Jerusalem', 'Asia/Karachi',
    'Asia/Kolkata', 'Asia/Kuala_Lumpur', 'Asia/Manila', 'Asia/Riyadh', 'Asia/Seoul',
    'Asia/Shanghai', 'Asia/Singapore', 'Asia/Taipei', 'Asia/Tashkent', 'Asia/Tehran',
    'Asia/Tokyo', 'Asia/Yerevan', 'Atlantic/Reykjavik', 'Australia/Adelaide', 'Australia/Brisbane',
    'Australia/Melbourne', 'Australia/Perth', 'Australia/Sydney', 'Europe/Amsterdam',
    'Europe/Athens', 'Europe/Berlin', 'Europe/Bucharest', 'Europe/Brussels', 'Europe/Copenhagen',
    'Europe/Dublin', 'Europe/Helsinki', 'Europe/Istanbul', 'Europe/Kyiv', 'Europe/Lisbon',
    'Europe/London', 'Europe/Madrid', 'Europe/Moscow', 'Europe/Oslo', 'Europe/Paris',
    'Europe/Prague', 'Europe/Rome', 'Europe/Stockholm', 'Europe/Vienna', 'Europe/Warsaw',
    'Europe/Zurich', 'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Honolulu',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------------------
// Defaults that mirror the Rust crate's `Default` impl. The PUT endpoint
// deep-merges with backend defaults so partial state is safe — these
// values are used purely for first-render UX.
// ---------------------------------------------------------------------------

function makeDefaultSettings(): ProjectSettings {
    return {
        defaults: {
            languageCode: 'en',
            parseMode: 'HTML',
            signatureLine: '',
            disableWebPagePreview: false,
            disableNotification: false,
            allowedLanguages: [],
            maxBroadcastConcurrency: 20,
            defaultRateLimit: {
                perChatPerSecond: 1,
                perBotPerSecond: 30,
                perBotPerMinute: 20,
            },
            retentionDays: {
                messages: 90,
                deliveries: 90,
                webhookLog: 90,
                sessions: 30,
            },
        },
        businessHours: {
            timezone: 'UTC',
            schedule: WEEKDAYS.map((_, i) => ({
                weekday: i,
                openHHMM: '09:00',
                closeHHMM: '18:00',
            })),
            outOfHoursReply: { kind: 'noop', payload: {} },
        },
        notifications: {
            dailyDigest: false,
            errorAlerts: true,
            slackWebhook: '',
            emailRecipients: [],
        },
        security: {
            rotateWebhookSecretEveryDays: null,
            requireBotAdmin: false,
            ipAllowlist: [],
        },
        gdpr: {
            dataRetentionDays: 365,
            autoDeleteIdleChatsDays: 180,
        },
    };
}

// ---------------------------------------------------------------------------
// Small reusable bits
// ---------------------------------------------------------------------------

interface ChipInputProps {
    label?: string;
    values: string[];
    onChange: (v: string[]) => void;
    placeholder?: string;
    validate?: (v: string) => boolean;
}

function ChipInput({ label, values, onChange, placeholder, validate }: ChipInputProps) {
    const [draft, setDraft] = React.useState('');
    const add = () => {
        const v = draft.trim();
        if (!v) return;
        if (validate && !validate(v)) return;
        if (values.includes(v)) {
            setDraft('');
            return;
        }
        onChange([...values, v]);
        setDraft('');
    };
    return (
        <div className="space-y-2">
            {label ? <Label>{label}</Label> : null}
            <div className="flex flex-wrap items-center gap-1 rounded border border-zoru-line bg-zoru-bg px-2 py-1.5">
                {values.map((v, i) => (
                    <span
                        key={`${v}-${i}`}
                        className="inline-flex items-center gap-1 rounded bg-zoru-fg/10 px-2 py-0.5 text-xs"
                    >
                        {v}
                        <button
                            type="button"
                            className="text-zoru-fg/60 hover:text-zoru-fg"
                            onClick={() => onChange(values.filter((_, j) => j !== i))}
                            aria-label={`Remove ${v}`}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            add();
                        } else if (e.key === 'Backspace' && !draft && values.length > 0) {
                            onChange(values.slice(0, -1));
                        }
                    }}
                    onBlur={add}
                    placeholder={placeholder ?? 'Type and press Enter'}
                    className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none"
                />
            </div>
        </div>
    );
}

function SwitchRow({
    label,
    value,
    onChange,
    description,
}: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
    description?: string;
}) {
    return (
        <div className="flex items-center justify-between gap-3 rounded border border-zoru-line bg-zoru-bg px-3 py-2 text-sm">
            <div>
                <div className="font-medium">{label}</div>
                {description ? (
                    <div className="text-xs text-zoru-fg/60">{description}</div>
                ) : null}
            </div>
            <Switch checked={value} onCheckedChange={onChange} />
        </div>
    );
}

function NumberRow({
    label,
    value,
    onChange,
    min,
    max,
}: {
    label: string;
    value: number | null | undefined;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
}) {
    return (
        <div className="space-y-1">
            <Label>{label}</Label>
            <Input
                type="number"
                value={value ?? 0}
                min={min}
                max={max}
                onChange={(e) => onChange(Number(e.target.value) || 0)}
            />
        </div>
    );
}

function SectionCard({
    icon: Icon,
    title,
    description,
    children,
    onSave,
    saving,
    extra,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description?: string;
    children: React.ReactNode;
    onSave?: () => void;
    saving?: boolean;
    extra?: React.ReactNode;
}) {
    return (
        <Card>
            <ZoruCardContent className="space-y-5 p-6">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                            style={{ backgroundColor: `${ACCENT}1A`, color: ACCENT }}
                        >
                            <Icon className="h-4 w-4" />
                        </span>
                        <div>
                            <h2 className="text-base font-semibold">{title}</h2>
                            {description ? (
                                <p className="text-sm text-zoru-fg/60">{description}</p>
                            ) : null}
                        </div>
                    </div>
                    {extra}
                </div>
                <div>{children}</div>
                {onSave ? (
                    <div className="flex justify-end pt-2">
                        <Button onClick={onSave} disabled={saving}>
                            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                            Save
                        </Button>
                    </div>
                ) : null}
            </ZoruCardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface BotOption {
    _id: string;
    label: string;
}

export default function TelegramSettingsPage() {
    const { activeProject } = useProject();
    const projectId = activeProject?._id?.toString() ?? '';
    const { toast } = useZoruToast();

    const [section, setSection] = React.useState<SectionId>('defaults');
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [settings, setSettings] = React.useState<ProjectSettings>(makeDefaultSettings);
    const [savingSection, setSavingSection] = React.useState<SectionId | null>(null);

    const [bots, setBots] = React.useState<BotOption[]>([]);
    const [selectedBotId, setSelectedBotId] = React.useState<string>('');
    const [botOverrides, setBotOverrides] = React.useState<Record<string, unknown>>({});
    const [overrideFlags, setOverrideFlags] = React.useState({
        defaults: false,
        businessHours: false,
        notifications: false,
        security: false,
    });

    const [gdpr, setGdpr] = React.useState<GdprRequestRow[]>([]);
    const [gdprConfirm, setGdprConfirm] = React.useState('');
    const [gdprDialogOpen, setGdprDialogOpen] = React.useState(false);
    const [gdprBusy, setGdprBusy] = React.useState(false);

    const [audit, setAudit] = React.useState<AuditRow[]>([]);
    const [auditCursor, setAuditCursor] = React.useState<string | undefined>(undefined);
    const [auditNextCursor, setAuditNextCursor] = React.useState<string | undefined>(undefined);
    const [auditLoading, setAuditLoading] = React.useState(false);

    // ---------------------- Load project settings ----------------------
    React.useEffect(() => {
        if (!projectId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            const res = await getTelegramProjectSettingsAction(projectId);
            if (cancelled) return;
            if (res.error) {
                setError(res.error);
            } else if (res.settings) {
                // Merge with defaults so any missing fields are filled in.
                const def = makeDefaultSettings();
                setSettings({
                    defaults: { ...def.defaults, ...res.settings.defaults },
                    businessHours: { ...def.businessHours, ...res.settings.businessHours },
                    notifications: { ...def.notifications, ...res.settings.notifications },
                    security: { ...def.security, ...res.settings.security },
                    gdpr: { ...def.gdpr, ...res.settings.gdpr },
                });
            }
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [projectId]);

    // ---------------------- Load bots for overrides ----------------------
    React.useEffect(() => {
        if (!projectId) return;
        let cancelled = false;
        (async () => {
            const rows = await listTelegramBots(projectId);
            if (cancelled) return;
            setBots(
                rows.map((b) => ({
                    _id: b._id,
                    label: b.name || b.username || b._id,
                })),
            );
        })();
        return () => {
            cancelled = true;
        };
    }, [projectId]);

    // ---------------------- Load overrides for selected bot ----------------------
    React.useEffect(() => {
        if (!projectId || !selectedBotId) {
            setBotOverrides({});
            setOverrideFlags({
                defaults: false,
                businessHours: false,
                notifications: false,
                security: false,
            });
            return;
        }
        let cancelled = false;
        (async () => {
            const res = await getTelegramBotOverridesAction(projectId, selectedBotId);
            if (cancelled) return;
            const o = (res.overrides ?? {}) as Record<string, unknown>;
            setBotOverrides(o);
            setOverrideFlags({
                defaults: 'defaults' in o,
                businessHours: 'businessHours' in o,
                notifications: 'notifications' in o,
                security: 'security' in o,
            });
        })();
        return () => {
            cancelled = true;
        };
    }, [projectId, selectedBotId]);

    // ---------------------- GDPR load ----------------------
    const reloadGdpr = React.useCallback(async () => {
        if (!projectId) return;
        const res = await listTelegramGdprRequestsAction(projectId);
        setGdpr(res.requests ?? []);
    }, [projectId]);

    React.useEffect(() => {
        if (section === 'gdpr') void reloadGdpr();
    }, [section, reloadGdpr]);

    // ---------------------- Audit load ----------------------
    const reloadAudit = React.useCallback(
        async (cursor?: string) => {
            if (!projectId) return;
            setAuditLoading(true);
            const res = await listTelegramSettingsAuditAction(projectId, { cursor, limit: 50 });
            setAuditLoading(false);
            if (cursor) {
                setAudit((prev) => [...prev, ...(res.rows ?? [])]);
            } else {
                setAudit(res.rows ?? []);
            }
            setAuditNextCursor(res.nextCursor);
        },
        [projectId],
    );

    React.useEffect(() => {
        if (section === 'audit') {
            setAuditCursor(undefined);
            void reloadAudit();
        }
    }, [section, reloadAudit]);

    // ---------------------- Save helpers ----------------------
    const saveAll = async (which: SectionId) => {
        if (!projectId) return;
        setSavingSection(which);
        const res = await saveTelegramProjectSettingsAction(projectId, settings);
        setSavingSection(null);
        if (res.success) {
            toast({ title: 'Settings saved', variant: 'success' });
        } else {
            toast({
                title: 'Failed to save',
                description: res.error ?? 'Unknown error',
                variant: 'destructive',
            });
        }
    };

    const saveOverrides = async () => {
        if (!projectId || !selectedBotId) return;
        const next: Record<string, unknown> = {};
        if (overrideFlags.defaults && botOverrides.defaults !== undefined) {
            next.defaults = botOverrides.defaults;
        }
        if (overrideFlags.businessHours && botOverrides.businessHours !== undefined) {
            next.businessHours = botOverrides.businessHours;
        }
        if (overrideFlags.notifications && botOverrides.notifications !== undefined) {
            next.notifications = botOverrides.notifications;
        }
        if (overrideFlags.security && botOverrides.security !== undefined) {
            next.security = botOverrides.security;
        }
        const res = await saveTelegramBotOverridesAction(projectId, selectedBotId, next);
        if (res.success) {
            toast({ title: 'Overrides saved', variant: 'success' });
        } else {
            toast({
                title: 'Failed to save overrides',
                description: res.error ?? 'Unknown error',
                variant: 'destructive',
            });
        }
    };

    const clearOverrides = async () => {
        if (!projectId || !selectedBotId) return;
        const res = await clearTelegramBotOverridesAction(projectId, selectedBotId);
        if (res.success) {
            setBotOverrides({});
            setOverrideFlags({
                defaults: false,
                businessHours: false,
                notifications: false,
                security: false,
            });
            toast({ title: 'Reverted to project defaults', variant: 'success' });
        } else {
            toast({
                title: 'Failed to clear overrides',
                description: res.error ?? 'Unknown error',
                variant: 'destructive',
            });
        }
    };

    // ---------------------- GDPR handlers ----------------------
    const requestExport = async () => {
        if (!projectId) return;
        setGdprBusy(true);
        const res = await requestTelegramDataExportAction(projectId);
        setGdprBusy(false);
        if (res.success) {
            toast({
                title: 'Export queued',
                description: res.requestId ? `Request ${res.requestId}` : undefined,
                variant: 'success',
            });
            await reloadGdpr();
        } else {
            toast({
                title: 'Failed to queue export',
                description: res.error ?? 'Unknown error',
                variant: 'destructive',
            });
        }
    };

    const requestDelete = async () => {
        if (!projectId) return;
        setGdprBusy(true);
        const res = await requestTelegramDataDeletionAction(projectId, gdprConfirm);
        setGdprBusy(false);
        if (res.success) {
            toast({ title: 'Deletion queued', variant: 'success' });
            setGdprDialogOpen(false);
            setGdprConfirm('');
            await reloadGdpr();
        } else {
            toast({
                title: 'Failed to queue deletion',
                description: res.error ?? 'Unknown error',
                variant: 'destructive',
            });
        }
    };

    // ---------------------- Render ----------------------
    if (!projectId) {
        return (
            <div className="p-6">
                <EmptyState
                    title="Select a project"
                    description="Choose an active project to configure Telegram settings."
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <TelegramProjectGate />
            <PageHeader>
                <ZoruPageHeading>
                    <ZoruPageEyebrow>Telegram</ZoruPageEyebrow>
                    <ZoruPageTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" style={{ color: ACCENT }} />
                        Telegram Settings
                    </ZoruPageTitle>
                    <ZoruPageDescription>
                        Project-wide defaults plus per-bot overrides for parse mode, signature,
                        business hours, notifications, security and GDPR.
                    </ZoruPageDescription>
                </ZoruPageHeading>
            </PageHeader>

            {/* Segmented section selector — no tab UI */}
            <div className="flex flex-wrap gap-2">
                {SECTIONS.map((s) => {
                    const Icon = s.icon;
                    const active = section === s.id;
                    return (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => setSection(s.id)}
                            className={
                                'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ' +
                                (active
                                    ? 'border-transparent text-white'
                                    : 'border-zoru-line bg-zoru-bg text-zoru-fg/70 hover:text-zoru-fg')
                            }
                            style={active ? { backgroundColor: ACCENT } : undefined}
                        >
                            <Icon className="h-4 w-4" />
                            {s.label}
                        </button>
                    );
                })}
            </div>

            {error ? (
                <Alert variant="destructive">
                    <ZoruAlertDescription>{error}</ZoruAlertDescription>
                </Alert>
            ) : null}

            {loading ? (
                <div className="space-y-3">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            ) : (
                <>
                    {section === 'defaults' ? (
                        <DefaultsSection
                            settings={settings}
                            setSettings={setSettings}
                            onSave={() => saveAll('defaults')}
                            saving={savingSection === 'defaults'}
                        />
                    ) : null}

                    {section === 'business-hours' ? (
                        <BusinessHoursSection
                            projectId={projectId}
                            settings={settings}
                            setSettings={setSettings}
                            onSave={() => saveAll('business-hours')}
                            saving={savingSection === 'business-hours'}
                        />
                    ) : null}

                    {section === 'notifications' ? (
                        <NotificationsSection
                            settings={settings}
                            setSettings={setSettings}
                            onSave={() => saveAll('notifications')}
                            saving={savingSection === 'notifications'}
                        />
                    ) : null}

                    {section === 'security' ? (
                        <SecuritySection
                            settings={settings}
                            setSettings={setSettings}
                            onSave={() => saveAll('security')}
                            saving={savingSection === 'security'}
                        />
                    ) : null}

                    {section === 'overrides' ? (
                        <OverridesSection
                            bots={bots}
                            selectedBotId={selectedBotId}
                            setSelectedBotId={setSelectedBotId}
                            overrides={botOverrides}
                            setOverrides={setBotOverrides}
                            flags={overrideFlags}
                            setFlags={setOverrideFlags}
                            onSave={saveOverrides}
                            onClear={clearOverrides}
                            projectDefaults={settings}
                        />
                    ) : null}

                    {section === 'gdpr' ? (
                        <GdprSection
                            settings={settings}
                            setSettings={setSettings}
                            requests={gdpr}
                            onExport={requestExport}
                            onDeleteOpen={() => setGdprDialogOpen(true)}
                            busy={gdprBusy}
                            onSaveGdpr={() => saveAll('gdpr')}
                            saving={savingSection === 'gdpr'}
                        />
                    ) : null}

                    {section === 'audit' ? (
                        <AuditSection
                            rows={audit}
                            nextCursor={auditNextCursor}
                            loading={auditLoading}
                            onLoadMore={() => {
                                if (auditNextCursor) {
                                    setAuditCursor(auditNextCursor);
                                    void reloadAudit(auditNextCursor);
                                }
                            }}
                        />
                    ) : null}
                </>
            )}

            <ZoruAlertDialog open={gdprDialogOpen} onOpenChange={setGdprDialogOpen}>
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Confirm data deletion</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            This queues a deletion job for every Telegram artefact attached to
                            this project (bots, chats, broadcasts, deliveries). The job is
                            irreversible once processed. Type <strong>DELETE</strong> to confirm.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <Input
                        value={gdprConfirm}
                        onChange={(e) => setGdprConfirm(e.target.value)}
                        placeholder="Type DELETE"
                    />
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={requestDelete}
                            disabled={gdprConfirm !== 'DELETE' || gdprBusy}
                        >
                            {gdprBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                            Queue deletion
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function DefaultsSection({
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

function BusinessHoursSection({
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

    const [testAt, setTestAt] = React.useState<string>(() => new Date().toISOString().slice(0, 16));
    const [testResult, setTestResult] = React.useState<boolean | null>(null);
    const [testing, setTesting] = React.useState(false);

    const runTest = async () => {
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
                        <Button variant="outline" onClick={runTest} disabled={testing}>
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

function NotificationsSection({
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
                        <p className="text-xs text-red-500">Must be a hooks.slack.com URL.</p>
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

function SecuritySection({
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

function OverridesSection({
    bots,
    selectedBotId,
    setSelectedBotId,
    overrides,
    setOverrides,
    flags,
    setFlags,
    onSave,
    onClear,
    projectDefaults,
}: {
    bots: BotOption[];
    selectedBotId: string;
    setSelectedBotId: (id: string) => void;
    overrides: Record<string, unknown>;
    setOverrides: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
    flags: { defaults: boolean; businessHours: boolean; notifications: boolean; security: boolean };
    setFlags: React.Dispatch<
        React.SetStateAction<{
            defaults: boolean;
            businessHours: boolean;
            notifications: boolean;
            security: boolean;
        }>
    >;
    onSave: () => void;
    onClear: () => void;
    projectDefaults: ProjectSettings;
}) {
    if (bots.length === 0) {
        return (
            <SectionCard icon={UserCog} title="Per-bot Overrides">
                <EmptyState
                    title="No bots yet"
                    description="Add a bot in the Bots page first."
                />
            </SectionCard>
        );
    }

    const overridesDefaults =
        (overrides.defaults as ProjectSettings['defaults'] | undefined) ?? projectDefaults.defaults;
    const overridesHours =
        (overrides.businessHours as ProjectSettings['businessHours'] | undefined) ??
        projectDefaults.businessHours;
    const overridesNotifications =
        (overrides.notifications as ProjectSettings['notifications'] | undefined) ??
        projectDefaults.notifications;
    const overridesSecurity =
        (overrides.security as ProjectSettings['security'] | undefined) ??
        projectDefaults.security;

    return (
        <SectionCard
            icon={UserCog}
            title="Per-bot Overrides"
            description="Override any subset of project settings for a specific bot."
            onSave={onSave}
            saving={false}
            extra={
                <Button
                    variant="outline"
                    onClick={onClear}
                    disabled={!selectedBotId}
                    className="gap-1"
                >
                    <Trash2 className="h-3 w-3" />
                    Revert to defaults
                </Button>
            }
        >
            <div className="space-y-4">
                <div className="space-y-1">
                    <Label>Bot</Label>
                    <Select value={selectedBotId} onValueChange={setSelectedBotId}>
                        <ZoruSelectTrigger>
                            <ZoruSelectValue placeholder="Select bot" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {bots.map((b) => (
                                <ZoruSelectItem key={b._id} value={b._id}>
                                    {b.label}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </Select>
                </div>

                {selectedBotId ? (
                    <>
                        <OverrideToggle
                            label="Override defaults"
                            on={flags.defaults}
                            onToggle={(v) => {
                                setFlags((p) => ({ ...p, defaults: v }));
                                if (v && overrides.defaults === undefined) {
                                    setOverrides((o) => ({
                                        ...o,
                                        defaults: { ...projectDefaults.defaults },
                                    }));
                                }
                            }}
                        >
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                    <Label>Parse mode</Label>
                                    <Select
                                        value={overridesDefaults.parseMode}
                                        onValueChange={(v) =>
                                            setOverrides((o) => ({
                                                ...o,
                                                defaults: { ...overridesDefaults, parseMode: v },
                                            }))
                                        }
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
                                <div className="space-y-1">
                                    <Label>Signature line</Label>
                                    <Input
                                        value={overridesDefaults.signatureLine ?? ''}
                                        onChange={(e) =>
                                            setOverrides((o) => ({
                                                ...o,
                                                defaults: {
                                                    ...overridesDefaults,
                                                    signatureLine: e.target.value,
                                                },
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                        </OverrideToggle>

                        <OverrideToggle
                            label="Override business hours"
                            on={flags.businessHours}
                            onToggle={(v) => {
                                setFlags((p) => ({ ...p, businessHours: v }));
                                if (v && overrides.businessHours === undefined) {
                                    setOverrides((o) => ({
                                        ...o,
                                        businessHours: { ...projectDefaults.businessHours },
                                    }));
                                }
                            }}
                        >
                            <div className="space-y-1">
                                <Label>Timezone</Label>
                                <Select
                                    value={overridesHours.timezone}
                                    onValueChange={(v) =>
                                        setOverrides((o) => ({
                                            ...o,
                                            businessHours: { ...overridesHours, timezone: v },
                                        }))
                                    }
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
                        </OverrideToggle>

                        <OverrideToggle
                            label="Override notifications"
                            on={flags.notifications}
                            onToggle={(v) => {
                                setFlags((p) => ({ ...p, notifications: v }));
                                if (v && overrides.notifications === undefined) {
                                    setOverrides((o) => ({
                                        ...o,
                                        notifications: { ...projectDefaults.notifications },
                                    }));
                                }
                            }}
                        >
                            <SwitchRow
                                label="Error alerts"
                                value={overridesNotifications.errorAlerts}
                                onChange={(v) =>
                                    setOverrides((o) => ({
                                        ...o,
                                        notifications: {
                                            ...overridesNotifications,
                                            errorAlerts: v,
                                        },
                                    }))
                                }
                            />
                        </OverrideToggle>

                        <OverrideToggle
                            label="Override security"
                            on={flags.security}
                            onToggle={(v) => {
                                setFlags((p) => ({ ...p, security: v }));
                                if (v && overrides.security === undefined) {
                                    setOverrides((o) => ({
                                        ...o,
                                        security: { ...projectDefaults.security },
                                    }));
                                }
                            }}
                        >
                            <SwitchRow
                                label="Require bot admin"
                                value={overridesSecurity.requireBotAdmin}
                                onChange={(v) =>
                                    setOverrides((o) => ({
                                        ...o,
                                        security: {
                                            ...overridesSecurity,
                                            requireBotAdmin: v,
                                        },
                                    }))
                                }
                            />
                        </OverrideToggle>
                    </>
                ) : null}
            </div>
        </SectionCard>
    );
}

function OverrideToggle({
    label,
    on,
    onToggle,
    children,
}: {
    label: string;
    on: boolean;
    onToggle: (v: boolean) => void;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded border border-zoru-line bg-zoru-bg p-3">
            <label className="flex items-center justify-between gap-3 pb-2 text-sm font-medium">
                <span>{label}</span>
                <Switch checked={on} onCheckedChange={onToggle} />
            </label>
            {on ? <div className="pt-2">{children}</div> : (
                <div className="text-xs text-zoru-fg/60">Use project default.</div>
            )}
        </div>
    );
}

function GdprSection({
    settings,
    setSettings,
    requests,
    onExport,
    onDeleteOpen,
    busy,
    onSaveGdpr,
    saving,
}: {
    settings: ProjectSettings;
    setSettings: React.Dispatch<React.SetStateAction<ProjectSettings>>;
    requests: GdprRequestRow[];
    onExport: () => void;
    onDeleteOpen: () => void;
    busy: boolean;
    onSaveGdpr: () => void;
    saving: boolean;
}) {
    const g = settings.gdpr;
    const update = <K extends keyof typeof g>(key: K, value: (typeof g)[K]) => {
        setSettings((prev) => ({ ...prev, gdpr: { ...prev.gdpr, [key]: value } }));
    };
    return (
        <SectionCard
            icon={Globe2}
            title="GDPR"
            description="Retention and one-shot export/delete requests."
            onSave={onSaveGdpr}
            saving={saving}
        >
            <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                    <NumberRow
                        label="Data retention (days)"
                        value={g.dataRetentionDays}
                        onChange={(v) => update('dataRetentionDays', v)}
                        min={1}
                    />
                    <NumberRow
                        label="Auto-delete idle chats after (days)"
                        value={g.autoDeleteIdleChatsDays}
                        onChange={(v) => update('autoDeleteIdleChatsDays', v)}
                        min={1}
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button onClick={onExport} disabled={busy} className="gap-1">
                        <Download className="h-3 w-3" />
                        Request data export
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={onDeleteOpen}
                        disabled={busy}
                        className="gap-1"
                    >
                        <Trash2 className="h-3 w-3" />
                        Request data deletion
                    </Button>
                </div>

                <div>
                    <div className="text-sm font-semibold">Recent requests</div>
                    {requests.length === 0 ? (
                        <p className="text-sm text-zoru-fg/60">No GDPR requests yet.</p>
                    ) : (
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Created</ZoruTableHead>
                                    <ZoruTableHead>Kind</ZoruTableHead>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                    <ZoruTableHead>Request id</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {requests.map((r) => (
                                    <ZoruTableRow key={r._id}>
                                        <ZoruTableCell>{r.createdAt.slice(0, 19).replace('T', ' ')}</ZoruTableCell>
                                        <ZoruTableCell>{r.kind}</ZoruTableCell>
                                        <ZoruTableCell>
                                            <Badge
                                                variant={
                                                    r.status === 'done'
                                                        ? 'success'
                                                        : r.status === 'failed'
                                                          ? 'destructive'
                                                          : 'warning'
                                                }
                                            >
                                                {r.status}
                                            </Badge>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-mono text-xs">
                                            {r._id}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </Table>
                    )}
                </div>
            </div>
        </SectionCard>
    );
}

function AuditSection({
    rows,
    nextCursor,
    loading,
    onLoadMore,
}: {
    rows: AuditRow[];
    nextCursor?: string;
    loading: boolean;
    onLoadMore: () => void;
}) {
    return (
        <SectionCard
            icon={ClipboardList}
            title="Audit"
            description="Every successful settings save is recorded here."
        >
            {rows.length === 0 ? (
                <EmptyState
                    title="No audit entries yet"
                    description="Once you save changes here, diffs will appear in this list."
                />
            ) : (
                <>
                    <Table>
                        <ZoruTableHeader>
                            <ZoruTableRow>
                                <ZoruTableHead>When</ZoruTableHead>
                                <ZoruTableHead>Actor</ZoruTableHead>
                                <ZoruTableHead>Field</ZoruTableHead>
                                <ZoruTableHead>Change</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {rows.map((r) => (
                                <ZoruTableRow key={r._id}>
                                    <ZoruTableCell className="whitespace-nowrap text-xs">
                                        {r.changedAt.slice(0, 19).replace('T', ' ')}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-mono text-xs">
                                        {r.actorId}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="font-mono text-xs">
                                        {r.field}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-xs">
                                        <span className="font-mono text-red-500">
                                            {r.oldValue.length > 60
                                                ? `${r.oldValue.slice(0, 60)}…`
                                                : r.oldValue || '∅'}
                                        </span>
                                        <ChevronRight className="mx-1 inline h-3 w-3 align-middle" />
                                        <span className="font-mono text-emerald-500">
                                            {r.newValue.length > 60
                                                ? `${r.newValue.slice(0, 60)}…`
                                                : r.newValue || '∅'}
                                        </span>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ))}
                        </ZoruTableBody>
                    </Table>
                    {nextCursor ? (
                        <div className="flex justify-center pt-3">
                            <Button variant="outline" onClick={onLoadMore} disabled={loading}>
                                {loading ? (
                                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                ) : null}
                                Load more
                            </Button>
                        </div>
                    ) : null}
                </>
            )}
        </SectionCard>
    );
}
