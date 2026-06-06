'use client';

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, Label, PageDescription, PageHeader, PageHeading, PageTitle, Switch, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState } from 'react';
import { Bell,
  LoaderCircle,
  Mail,
  Save,
  Smartphone } from 'lucide-react';

import {
    getNotificationPrefs,
    setNotificationPrefs,
} from '@/app/actions/account.actions';
import { useT } from '@/lib/i18n/client';

type Prefs = Record<string, boolean>;

type Group = {
    titleKey: string;
    descriptionKey: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    rows: Array<{ id: string; labelKey: string; descriptionKey: string }>;
};

const GROUPS: Group[] = [
    {
        titleKey: 'settings.notifications.groups.account.title',
        descriptionKey: 'settings.notifications.groups.account.description',
        icon: Mail,
        rows: [
            { id: 'billing_receipts', labelKey: 'settings.notifications.rows.billing_receipts.label', descriptionKey: 'settings.notifications.rows.billing_receipts.description' },
            { id: 'plan_changes', labelKey: 'settings.notifications.rows.plan_changes.label', descriptionKey: 'settings.notifications.rows.plan_changes.description' },
            { id: 'low_credits', labelKey: 'settings.notifications.rows.low_credits.label', descriptionKey: 'settings.notifications.rows.low_credits.description' },
        ],
    },
    {
        titleKey: 'settings.notifications.groups.product.title',
        descriptionKey: 'settings.notifications.groups.product.description',
        icon: Bell,
        rows: [
            { id: 'release_notes', labelKey: 'settings.notifications.rows.release_notes.label', descriptionKey: 'settings.notifications.rows.release_notes.description' },
            { id: 'incidents', labelKey: 'settings.notifications.rows.incidents.label', descriptionKey: 'settings.notifications.rows.incidents.description' },
            { id: 'newsletter', labelKey: 'settings.notifications.rows.newsletter.label', descriptionKey: 'settings.notifications.rows.newsletter.description' },
        ],
    },
    {
        titleKey: 'settings.notifications.groups.mobile.title',
        descriptionKey: 'settings.notifications.groups.mobile.description',
        icon: Smartphone,
        rows: [
            { id: 'push_messages', labelKey: 'settings.notifications.rows.push_messages.label', descriptionKey: 'settings.notifications.rows.push_messages.description' },
            { id: 'push_mentions', labelKey: 'settings.notifications.rows.push_mentions.label', descriptionKey: 'settings.notifications.rows.push_mentions.description' },
            { id: 'push_approvals', labelKey: 'settings.notifications.rows.push_approvals.label', descriptionKey: 'settings.notifications.rows.push_approvals.description' },
        ],
    },
];

const DEFAULTS: Prefs = {
    billing_receipts: true,
    plan_changes: true,
    low_credits: true,
    release_notes: true,
    incidents: true,
    newsletter: false,
    push_messages: true,
    push_mentions: true,
    push_approvals: false,
};

export default function NotificationsSettingsPage() {
    const { t } = useT();
    const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        let cancelled = false;
        getNotificationPrefs()
            .then((server) => {
                if (cancelled) return;
                setPrefs({ ...DEFAULTS, ...server });
            })
            .catch(() => {
                /* fall through to defaults */
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const toggle = (id: string) => setPrefs((p) => ({ ...p, [id]: !p[id] }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await setNotificationPrefs(prefs);
            toast({ title: t('settings.notifications.toast.saved') });
        } catch (e: any) {
            toast({
                title: t('settings.notifications.toast.saveFailed'),
                description: e?.message ?? t('common.tryAgain'),
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex min-h-full flex-col gap-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/settings">{t('settings.overview.title')}</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{t('settings.notifications.title')}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <PageHeader>
                    <PageHeading>
                        <PageTitle>{t('settings.notifications.title')}</PageTitle>
                        <PageDescription>
                            {t('settings.notifications.subtitle')}
                        </PageDescription>
                    </PageHeading>
                </PageHeader>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? t('common.saving') : t('settings.notifications.savePreferences')}
                </Button>
            </div>

            {GROUPS.map((group) => (
                <Card key={group.titleKey} className="p-6">
                    <div className="mb-4 flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                            <group.icon className="h-4 w-4" strokeWidth={2} />
                        </div>
                        <div>
                            <p className="text-sm text-[var(--st-text)]">{t(group.titleKey)}</p>
                            <p className="text-xs text-[var(--st-text-secondary)]">{t(group.descriptionKey)}</p>
                        </div>
                    </div>
                    <ul className="divide-y divide-[var(--st-border)]">
                        {group.rows.map((row) => (
                            <li key={row.id} className="flex items-start justify-between gap-4 py-3">
                                <div>
                                    <Label htmlFor={row.id} className="text-[13px]">
                                        {t(row.labelKey)}
                                    </Label>
                                    <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">{t(row.descriptionKey)}</p>
                                </div>
                                <Switch id={row.id} checked={!!prefs[row.id]} onCheckedChange={() => toggle(row.id)} />
                            </li>
                        ))}
                    </ul>
                </Card>
            ))}
        </div>
    );
}
