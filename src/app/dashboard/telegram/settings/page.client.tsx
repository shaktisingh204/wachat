'use client';

import * as React from 'react';
import {
    Alert,
    AlertDescription,
    EmptyState,
    PageEyebrow,
    PageHeader,
    PageHeading,
    PageTitle,
    PageDescription,
    SegmentedControl,
    Skeleton,
    useToast,
} from '@/components/sabcrm/20ui';
import { Settings, Sparkles, Clock3, AlertCircle, ShieldAlert, UserCog, Globe2, ClipboardList } from 'lucide-react';
import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';
import { getTelegramProjectSettingsAction, saveTelegramProjectSettingsAction } from '@/app/actions/telegram-settings.actions';
import type { ProjectSettings } from '@/lib/rust-client/telegram-settings';

import { DefaultsSection, BusinessHoursSection, NotificationsSection, SecuritySection } from './_components/simple-sections';
import { OverridesSection } from './_components/overrides-section';
import { GdprSection } from './_components/gdpr-section';
import { AuditSection } from './_components/audit-section';
import { WEEKDAYS } from './constants';

const SECTIONS = [
    { value: 'defaults', label: 'Defaults', icon: Sparkles },
    { value: 'business-hours', label: 'Business Hours', icon: Clock3 },
    { value: 'notifications', label: 'Notifications', icon: AlertCircle },
    { value: 'security', label: 'Security', icon: ShieldAlert },
    { value: 'overrides', label: 'Per-bot Overrides', icon: UserCog },
    { value: 'gdpr', label: 'GDPR', icon: Globe2 },
    { value: 'audit', label: 'Audit', icon: ClipboardList },
] as const;

type SectionId = (typeof SECTIONS)[number]['value'];

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

export default function TelegramSettingsPage() {
    const { activeProject } = useProject();
    const projectId = activeProject?._id?.toString() ?? '';
    const { toast } = useToast();

    const [section, setSection] = React.useState<SectionId>('defaults');
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [settings, setSettings] = React.useState<ProjectSettings>(makeDefaultSettings);
    const [savingSection, setSavingSection] = React.useState<SectionId | null>(null);

    React.useEffect(() => {
        if (!projectId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const res = await getTelegramProjectSettingsAction(projectId);
                if (cancelled) return;
                if (res.error) {
                    setError(res.error);
                } else if (res.settings) {
                    const def = makeDefaultSettings();
                    setSettings({
                        defaults: { ...def.defaults, ...res.settings.defaults },
                        businessHours: { ...def.businessHours, ...res.settings.businessHours },
                        notifications: { ...def.notifications, ...res.settings.notifications },
                        security: { ...def.security, ...res.settings.security },
                        gdpr: { ...def.gdpr, ...res.settings.gdpr },
                    });
                }
            } catch (e) {
                if (!cancelled) {
                    setError('Failed to fetch project settings.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [projectId]);

    const saveAll = async (which: SectionId) => {
        if (!projectId) return;
        setSavingSection(which);
        try {
            const res = await saveTelegramProjectSettingsAction(projectId, settings);
            if (res.success) {
                toast({ title: 'Settings saved', tone: 'success' });
            } else {
                toast({
                    title: 'Failed to save',
                    description: res.error ?? 'Unknown error',
                    tone: 'danger',
                });
            }
        } catch (e) {
            toast({ title: 'Failed to save settings', tone: 'danger' });
        } finally {
            setSavingSection(null);
        }
    };

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
                <PageHeading>
                    <PageEyebrow>Telegram</PageEyebrow>
                    <PageTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-[var(--st-accent)]" aria-hidden="true" />
                        Telegram Settings
                    </PageTitle>
                    <PageDescription>
                        Project-wide defaults plus per-bot overrides for parse mode, signature,
                        business hours, notifications, security and GDPR.
                    </PageDescription>
                </PageHeading>
            </PageHeader>

            <SegmentedControl<SectionId>
                aria-label="Settings section"
                items={SECTIONS}
                value={section}
                onChange={setSection}
            />

            {error ? (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}

            {loading ? (
                <div className="space-y-4">
                    <Skeleton className="h-48 w-full rounded-xl" />
                    <Skeleton className="h-32 w-full rounded-xl" />
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
                            projectId={projectId}
                            projectDefaults={settings}
                        />
                    ) : null}

                    {section === 'gdpr' ? (
                        <GdprSection
                            projectId={projectId}
                            settings={settings}
                            setSettings={setSettings}
                            onSave={() => saveAll('gdpr')}
                            saving={savingSection === 'gdpr'}
                        />
                    ) : null}

                    {section === 'audit' ? (
                        <AuditSection projectId={projectId} />
                    ) : null}
                </>
            )}
        </div>
    );
}
