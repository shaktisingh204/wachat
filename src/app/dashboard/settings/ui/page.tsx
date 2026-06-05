'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Label,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Switch,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState } from 'react';
import { Eye,
  LoaderCircle,
  Monitor,
  Moon,
  Save,
  Sun } from 'lucide-react';

import {
    getAppearancePrefs,
    setAppearancePrefs,
    type AppearancePrefs,
} from '@/app/actions/account.actions';
import { useT } from '@/lib/i18n/client';
import { applyTheme } from '@/components/zoruui/shell/app-theme';

type Appearance = AppearancePrefs;

const DEFAULTS: Appearance = {
    theme: 'system',
    density: 'comfortable',
    sidebarCollapsed: false,
    reducedMotion: false,
};

export default function AppearanceSettingsPage() {
    const { t } = useT();
    const [prefs, setPrefs] = useState<Appearance>(DEFAULTS);
    const [saving, setSaving] = useState(false);
    const { toast } = useZoruToast();

    useEffect(() => {
        let cancelled = false;
        getAppearancePrefs()
            .then((server) => {
                if (cancelled) return;
                const merged = { ...DEFAULTS, ...server };
                setPrefs(merged);
                // Seed localStorage + apply the server-stored theme so the
                // no-FOUC bootstrap and the header toggle match it next load.
                applyTheme(merged.theme);
            })
            .catch(() => {
                /* fall through to defaults */
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await setAppearancePrefs(prefs);
            // Apply + persist the theme immediately (also writes localStorage so
            // the no-FOUC bootstrap and header toggle stay in sync).
            applyTheme(prefs.theme);
            toast({ title: t('settings.appearance.toast.saved') });
        } catch (e: any) {
            toast({
                title: t('settings.appearance.toast.saveFailed'),
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
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/settings">{t('settings.overview.title')}</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>{t('settings.appearance.title')}</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <PageHeader>
                    <ZoruPageHeading>
                        <ZoruPageTitle>{t('settings.appearance.title')}</ZoruPageTitle>
                        <ZoruPageDescription>
                            {t('settings.appearance.subtitle')}
                        </ZoruPageDescription>
                    </ZoruPageHeading>
                </PageHeader>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? t('common.saving') : t('action.save')}
                </Button>
            </div>

            {/* Theme */}
            <Card className="p-6">
                <SectionTitle
                    icon={<Eye className="h-4 w-4" />}
                    title={t('settings.appearance.theme.title')}
                    description={t('settings.appearance.theme.description')}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <ThemeTile
                        selected={prefs.theme === 'system'}
                        icon={<Monitor className="h-5 w-5" />}
                        label={t('settings.appearance.theme.system')}
                        onClick={() => setPrefs({ ...prefs, theme: 'system' })}
                    />
                    <ThemeTile
                        selected={prefs.theme === 'light'}
                        icon={<Sun className="h-5 w-5" />}
                        label={t('settings.appearance.theme.light')}
                        onClick={() => setPrefs({ ...prefs, theme: 'light' })}
                    />
                    <ThemeTile
                        selected={prefs.theme === 'dark'}
                        icon={<Moon className="h-5 w-5" />}
                        label={t('settings.appearance.theme.dark')}
                        onClick={() => setPrefs({ ...prefs, theme: 'dark' })}
                    />
                </div>
            </Card>

            {/* Density */}
            <Card className="p-6">
                <SectionTitle
                    icon={<Eye className="h-4 w-4" />}
                    title={t('settings.appearance.density.title')}
                    description={t('settings.appearance.density.description')}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <DensityTile
                        selected={prefs.density === 'comfortable'}
                        label={t('settings.appearance.density.comfortable.label')}
                        description={t('settings.appearance.density.comfortable.description')}
                        onClick={() => setPrefs({ ...prefs, density: 'comfortable' })}
                    />
                    <DensityTile
                        selected={prefs.density === 'compact'}
                        label={t('settings.appearance.density.compact.label')}
                        description={t('settings.appearance.density.compact.description')}
                        onClick={() => setPrefs({ ...prefs, density: 'compact' })}
                    />
                </div>
            </Card>

            {/* Misc */}
            <Card className="p-6">
                <SectionTitle
                    icon={<Eye className="h-4 w-4" />}
                    title={t('settings.appearance.motion.title')}
                    description={t('settings.appearance.motion.description')}
                />
                <ul className="divide-y divide-zoru-line">
                    <Row
                        id="collapsed"
                        label={t('settings.appearance.motion.sidebar.label')}
                        description={t('settings.appearance.motion.sidebar.description')}
                        checked={prefs.sidebarCollapsed}
                        onChange={(v) => setPrefs({ ...prefs, sidebarCollapsed: v })}
                    />
                    <Row
                        id="reduced-motion"
                        label={t('settings.appearance.motion.reducedMotion.label')}
                        description={t('settings.appearance.motion.reducedMotion.description')}
                        checked={prefs.reducedMotion}
                        onChange={(v) => setPrefs({ ...prefs, reducedMotion: v })}
                    />
                </ul>
            </Card>
        </div>
    );
}

function SectionTitle({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className="mb-4 flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted">
                {icon}
            </div>
            <div>
                <p className="text-sm text-zoru-ink">{title}</p>
                <p className="text-xs text-zoru-ink-muted">{description}</p>
            </div>
        </div>
    );
}

function ThemeTile({
    selected,
    icon,
    label,
    onClick,
}: {
    selected: boolean;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex items-center gap-3 rounded-xl border p-4 text-left transition-colors',
                selected
                    ? 'border-zoru-ink bg-zoru-surface-2'
                    : 'border-zoru-line bg-zoru-bg hover:border-zoru-line',
            )}
        >
            <div
                className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg',
                    selected ? 'bg-zoru-ink text-zoru-bg' : 'bg-zoru-surface-2 text-zoru-ink',
                )}
            >
                {icon}
            </div>
            <span className="text-[13px] text-zoru-ink">{label}</span>
        </button>
    );
}

function DensityTile({
    selected,
    label,
    description,
    onClick,
}: {
    selected: boolean;
    label: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'rounded-xl border p-4 text-left transition-colors',
                selected
                    ? 'border-zoru-ink bg-zoru-surface-2'
                    : 'border-zoru-line bg-zoru-bg hover:border-zoru-line',
            )}
        >
            <p className="text-[13px] text-zoru-ink">{label}</p>
            <p className="mt-1 text-xs text-zoru-ink-muted">{description}</p>
        </button>
    );
}

function Row({
    id,
    label,
    description,
    checked,
    onChange,
}: {
    id: string;
    label: string;
    description: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <li className="flex items-start justify-between gap-4 py-3">
            <div>
                <Label htmlFor={id} className="text-[13px]">
                    {label}
                </Label>
                <p className="mt-0.5 text-xs text-zoru-ink-muted">{description}</p>
            </div>
            <Switch id={id} checked={checked} onCheckedChange={onChange} />
        </li>
    );
}
