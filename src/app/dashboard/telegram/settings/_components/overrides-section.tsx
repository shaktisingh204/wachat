import * as React from 'react';
import Link from 'next/link';
import { Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Input, Switch, Button, EmptyState } from '@/components/sabcrm/20ui/compat';
import { UserCog, Trash2 } from 'lucide-react';
import { SectionCard, SwitchRow } from './shared';
import { PARSE_MODES, IANA_TIMEZONES } from '../constants';
import type { ProjectSettings } from '@/lib/rust-client/telegram-settings';
import { getTelegramBotOverridesAction, saveTelegramBotOverridesAction, clearTelegramBotOverridesAction } from '@/app/actions/telegram-settings.actions';
import { listTelegramBots } from '@/app/actions/telegram.actions';
import { useToast } from '@/components/sabcrm/20ui/compat';

interface BotOption {
    _id: string;
    label: string;
}

export function OverridesSection({
    projectId,
    projectDefaults,
}: {
    projectId: string;
    projectDefaults: ProjectSettings;
}) {
    const { toast } = useToast();
    const [bots, setBots] = React.useState<BotOption[]>([]);
    const [selectedBotId, setSelectedBotId] = React.useState<string>('');
    const [overrides, setOverrides] = React.useState<Record<string, unknown>>({});
    const [flags, setFlags] = React.useState({
        defaults: false,
        businessHours: false,
        notifications: false,
        security: false,
    });
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (!projectId) return;
        let cancelled = false;
        (async () => {
            try {
                const rows = await listTelegramBots(projectId);
                if (cancelled) return;
                setBots(
                    rows.map((b) => ({
                        _id: b._id,
                        label: b.name || b.username || b._id,
                    })),
                );
            } catch (e) {
                if (!cancelled) {
                    toast({ title: 'Failed to load bots', variant: 'destructive' });
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [projectId, toast]);

    React.useEffect(() => {
        if (!projectId || !selectedBotId) {
            setOverrides({});
            setFlags({
                defaults: false,
                businessHours: false,
                notifications: false,
                security: false,
            });
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await getTelegramBotOverridesAction(projectId, selectedBotId);
                if (cancelled) return;
                const o = (res.overrides ?? {}) as Record<string, unknown>;
                setOverrides(o);
                setFlags({
                    defaults: 'defaults' in o,
                    businessHours: 'businessHours' in o,
                    notifications: 'notifications' in o,
                    security: 'security' in o,
                });
            } catch (e) {
                if (!cancelled) {
                    toast({ title: 'Failed to load bot overrides', variant: 'destructive' });
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [projectId, selectedBotId, toast]);

    const onSave = async () => {
        if (!projectId || !selectedBotId) return;
        setSaving(true);
        const next: Record<string, unknown> = {};
        if (flags.defaults && overrides.defaults !== undefined) {
            next.defaults = overrides.defaults;
        }
        if (flags.businessHours && overrides.businessHours !== undefined) {
            next.businessHours = overrides.businessHours;
        }
        if (flags.notifications && overrides.notifications !== undefined) {
            next.notifications = overrides.notifications;
        }
        if (flags.security && overrides.security !== undefined) {
            next.security = overrides.security;
        }
        try {
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
        } catch (e) {
            toast({ title: 'Failed to save overrides', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const onClear = async () => {
        if (!projectId || !selectedBotId) return;
        setSaving(true);
        try {
            const res = await clearTelegramBotOverridesAction(projectId, selectedBotId);
            if (res.success) {
                setOverrides({});
                setFlags({
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
        } catch (e) {
            toast({ title: 'Failed to clear overrides', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    if (bots.length === 0) {
        return (
            <SectionCard icon={UserCog} title="Per-bot Overrides">
                <EmptyState
                    title="No bots yet"
                    description="Add a bot in the Bots page first."
                />
                <div className="flex justify-center">
                    <Button variant="outline" asChild>
                        <Link href="/dashboard/telegram/bots">Go to Bots</Link>
                    </Button>
                </div>
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
            saving={saving}
            extra={
                <Button
                    variant="outline"
                    onClick={onClear}
                    disabled={!selectedBotId || saving}
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
                        <SelectTrigger>
                            <SelectValue placeholder="Select bot" />
                        </SelectTrigger>
                        <SelectContent>
                            {bots.map((b) => (
                                <SelectItem key={b._id} value={b._id}>
                                    {b.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
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
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PARSE_MODES.map((m) => (
                                                <SelectItem key={m.value} value={m.value}>
                                                    {m.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
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
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {IANA_TIMEZONES.map((tz) => (
                                            <SelectItem key={tz} value={tz}>
                                                {tz}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
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
        <div className="rounded border border-[var(--st-border)] bg-[var(--st-bg)] p-3">
            <label className="flex items-center justify-between gap-3 pb-2 text-sm font-medium">
                <span>{label}</span>
                <Switch checked={on} onCheckedChange={onToggle} />
            </label>
            {on ? <div className="pt-2">{children}</div> : (
                <div className="text-xs text-[var(--st-text)]/60">Use project default.</div>
            )}
        </div>
    );
}
